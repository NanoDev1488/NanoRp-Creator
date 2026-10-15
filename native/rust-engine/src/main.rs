use sha1::{Digest, Sha1};
use std::env;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        std::process::exit(1);
    }

    match args[1].as_str() {
        "check-image" => {
            if args.len() < 3 {
                eprintln!("Error: missing image path");
                std::process::exit(1);
            }
            check_image(&args[2]);
        }
        "fix-image" => {
            if args.len() < 4 {
                eprintln!("Error: usage: fix-image <input> <output> [mode]");
                std::process::exit(1);
            }
            let mode = if args.len() >= 5 { &args[4] } else { "smart-pad" };
            fix_image(&args[2], &args[3], mode);
        }
        "pack-zip" => {
            if args.len() < 4 {
                eprintln!("Error: usage: pack-zip <source_dir> <output_zip>");
                std::process::exit(1);
            }
            pack_zip(&args[2], &args[3]);
        }
        "hash" => {
            if args.len() < 3 {
                eprintln!("Error: missing file path");
                std::process::exit(1);
            }
            compute_sha1(&args[2]);
        }
        _ => {
            eprintln!("Unknown command: {}", args[1]);
            print_usage();
            std::process::exit(1);
        }
    }
}

fn print_usage() {
    println!(r#"{{"engine": "NanoRp-Rust-Engine", "version": "1.0.0", "commands": ["check-image", "fix-image", "pack-zip", "hash"]}}"#);
}

fn check_image(path_str: &str) {
    let path = Path::new(path_str);
    if !path.exists() {
        println!(r#"{{"error": "File not found: {}"}}"#, path_str);
        std::process::exit(2);
    }

    let img = match image::open(path) {
        Ok(i) => i,
        Err(e) => {
            println!(r#"{{"error": "Failed to read image: {}"}}"#, e);
            std::process::exit(3);
        }
    };

    let w = img.width();
    let h = img.height();
    let is_even_w = (w % 2) == 0;
    let is_even_h = (h % 2) == 0;
    let valid = is_even_w && is_even_h;

    let suggested_w = if is_even_w { w } else { w + 1 };
    let suggested_h = if is_even_h { h } else { h + 1 };

    println!(
        r#"{{"success": true, "path": "{}", "width": {}, "height": {}, "is_even_w": {}, "is_even_h": {}, "valid": {}, "suggested_w": {}, "suggested_h": {}}}"#,
        path_str.replace('\\', "\\\\"),
        w,
        h,
        is_even_w,
        is_even_h,
        valid,
        suggested_w,
        suggested_h
    );
}

fn fix_image(input_str: &str, output_str: &str, _mode: &str) {
    let in_path = Path::new(input_str);
    let img = match image::open(in_path) {
        Ok(i) => i.to_rgba8(),
        Err(e) => {
            println!(r#"{{"error": "Failed to open image: {}"}}"#, e);
            std::process::exit(1);
        }
    };

    let w = img.width();
    let h = img.height();
    let target_w = if w % 2 == 0 { w } else { w + 1 };
    let target_h = if h % 2 == 0 { h } else { h + 1 };

    let mut new_img = image::RgbaImage::new(target_w, target_h);

    // Copy original pixels
    for y in 0..h {
        for x in 0..w {
            new_img.put_pixel(x, y, *img.get_pixel(x, y));
        }
    }

    // Smart edge padding if width was odd: duplicate last column (edge clamp preserving pixel art)
    if target_w > w {
        let last_x = w - 1;
        for y in 0..h {
            let px = *img.get_pixel(last_x, y);
            new_img.put_pixel(w, y, px);
        }
    }

    // Smart edge padding if height was odd: duplicate last row
    if target_h > h {
        let last_y = h - 1;
        for x in 0..target_w {
            let src_x = if x < w { x } else { w - 1 };
            let px = *img.get_pixel(src_x, last_y);
            new_img.put_pixel(x, h, px);
        }
    }

    let out_path = Path::new(output_str);
    if let Some(parent) = out_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    match new_img.save_with_format(out_path, image::ImageFormat::Png) {
        Ok(_) => {
            println!(
                r#"{{"success": true, "old_w": {}, "old_h": {}, "new_w": {}, "new_h": {}, "saved_to": "{}"}}"#,
                w,
                h,
                target_w,
                target_h,
                output_str.replace('\\', "\\\\")
            );
        }
        Err(e) => {
            println!(r#"{{"error": "Failed to save image: {}"}}"#, e);
            std::process::exit(2);
        }
    }
}

fn pack_zip(src_dir_str: &str, output_zip_str: &str) {
    let src_dir = Path::new(src_dir_str);
    if !src_dir.is_dir() {
        println!(r#"{{"error": "Source is not a directory: {}"}}"#, src_dir_str);
        std::process::exit(1);
    }

    let zip_file = match File::create(output_zip_str) {
        Ok(f) => f,
        Err(e) => {
            println!(r#"{{"error": "Failed to create output zip: {}"}}"#, e);
            std::process::exit(2);
        }
    };

    let mut zip = ZipWriter::new(BufWriter::new(zip_file));
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut buffer = Vec::new();
    let mut file_count = 0usize;

    for entry in WalkDir::new(src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path == src_dir {
            continue;
        }

        let name = match path.strip_prefix(src_dir) {
            Ok(p) => p.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };

        if path.is_file() {
            if zip.start_file(&name, options).is_err() {
                continue;
            }
            if let Ok(mut f) = File::open(path) {
                buffer.clear();
                if f.read_to_end(&mut buffer).is_ok() {
                    let _ = zip.write_all(&buffer);
                    file_count += 1;
                }
            }
        } else if path.is_dir() && !name.is_empty() {
            let _ = zip.add_directory(&name, options);
        }
    }

    if let Err(e) = zip.finish() {
        println!(r#"{{"error": "Failed to finalize zip: {}"}}"#, e);
        std::process::exit(3);
    }

    // Compute SHA1 of generated zip
    let sha1_str = calculate_sha1_for_file(Path::new(output_zip_str)).unwrap_or_default();
    let file_size = fs::metadata(output_zip_str).map(|m| m.len()).unwrap_or(0);

    println!(
        r#"{{"success": true, "files_packed": {}, "size_bytes": {}, "sha1": "{}", "zip_path": "{}"}}"#,
        file_count,
        file_size,
        sha1_str,
        output_zip_str.replace('\\', "\\\\")
    );
}

fn compute_sha1(path_str: &str) {
    match calculate_sha1_for_file(Path::new(path_str)) {
        Ok(sha) => println!(r#"{{"success": true, "path": "{}", "sha1": "{}"}}"#, path_str.replace('\\', "\\\\"), sha),
        Err(e) => println!(r#"{{"error": "Failed to compute sha1: {}"}}"#, e),
    }
}

fn calculate_sha1_for_file(path: &Path) -> Result<String, std::io::Error> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha1::new();
    let mut buf = [0u8; 16384];

    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }

    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}
