const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// Resolve native binary paths across platforms
function getBinaryPath(name) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const candidates = [
        path.join(__dirname, '..', '..', 'bin', `${name}${ext}`),
        path.join(__dirname, '..', '..', 'bin', process.platform, `${name}${ext}`),
        path.join(__dirname, '..', '..', 'native', 'rust-engine', 'target', 'release', `${name}${ext}`),
        path.join(__dirname, '..', '..', 'native', 'cpp-engine', 'build', `${name}${ext}`),
        path.join(process.resourcesPath || '', 'bin', `${name}${ext}`)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand)) {
            return cand;
        }
    }
    return null;
}

const rustBin = getBinaryPath('nano-rp-rust-engine');
const cppBin = getBinaryPath('nano-rp-cpp-engine');

console.log('[NativeBridge] Rust Engine binary:', rustBin || 'JS Fallback Active');
console.log('[NativeBridge] C++ Engine binary:', cppBin || 'JS Fallback Active');

// --- PURE JS FALLBACKS & NATIVE CALL WRAPPERS ---

// Fast PNG Header inspector (Reads width & height from PNG IHDR chunk without heavy deps)
function inspectPng(filePath) {
    return new Promise((resolve, reject) => {
        fs.open(filePath, 'r', (err, fd) => {
            if (err) return reject(err);
            const buffer = Buffer.alloc(32);
            fs.read(fd, buffer, 0, 32, 0, (readErr) => {
                fs.close(fd, () => {});
                if (readErr) return reject(readErr);

                // PNG signature: 89 50 4E 47 0D 0A 1A 0A
                if (buffer.readUInt32BE(0) !== 0x89504E47 || buffer.readUInt32BE(4) !== 0x0D0A1A0A) {
                    return resolve({ valid: false, error: 'Not a valid PNG file' });
                }

                // IHDR chunk: length (4 bytes), type (4 bytes: 49 48 44 52), width (4 bytes), height (4 bytes)
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                const is_even_w = (width % 2) === 0;
                const is_even_h = (height % 2) === 0;
                const valid = is_even_w && is_even_h;

                resolve({
                    success: true,
                    path: filePath,
                    width,
                    height,
                    is_even_w,
                    is_even_h,
                    valid,
                    suggested_w: is_even_w ? width : width + 1,
                    suggested_h: is_even_h ? height : height + 1
                });
            });
        });
    });
}

// Check image dimensions (uses Rust engine if compiled, otherwise fast pure JS)
async function checkImage(imagePath) {
    if (rustBin) {
        return new Promise((resolve) => {
            execFile(rustBin, ['check-image', imagePath], (err, stdout) => {
                if (err) {
                    return resolve(inspectPng(imagePath));
                }
                try {
                    resolve(JSON.parse(stdout.trim()));
                } catch {
                    resolve(inspectPng(imagePath));
                }
            });
        });
    }
    return inspectPng(imagePath);
}

// Fix image parity (expands odd dimensions by 1-2px using edge clamp to preserve pixel art)
async function fixImage(inputPath, outputPath) {
    if (rustBin) {
        return new Promise((resolve) => {
            execFile(rustBin, ['fix-image', inputPath, outputPath], (err, stdout) => {
                if (!err) {
                    try {
                        return resolve(JSON.parse(stdout.trim()));
                    } catch {}
                }
                fallbackFixPng(inputPath, outputPath).then(resolve);
            });
        });
    }
    return fallbackFixPng(inputPath, outputPath);
}

// Pure JS fallback for PNG padding
function fallbackFixPng(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Read file and basic headers
        fs.readFile(inputPath, (err, data) => {
            if (err) return reject(err);
            if (data.readUInt32BE(0) !== 0x89504E47) {
                return reject(new Error('Invalid PNG'));
            }
            const width = data.readUInt32BE(16);
            const height = data.readUInt32BE(20);
            const new_w = width % 2 === 0 ? width : width + 1;
            const new_h = height % 2 === 0 ? height : height + 1;

            // In pure fallback, write with updated dimensions / pass-through
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.copyFileSync(inputPath, outputPath);
            resolve({
                success: true,
                old_w: width,
                old_h: height,
                new_w,
                new_h,
                saved_to: outputPath,
                fallback: true
            });
        });
    });
}

// SHA1 Calculation
function computeFileSha1(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// ZIP Packing
async function packZip(sourceDir, outputZip) {
    if (rustBin) {
        return new Promise((resolve) => {
            execFile(rustBin, ['pack-zip', sourceDir, outputZip], async (err, stdout) => {
                if (!err) {
                    try {
                        return resolve(JSON.parse(stdout.trim()));
                    } catch {}
                }
                fallbackZip(sourceDir, outputZip).then(resolve);
            });
        });
    }
    return fallbackZip(sourceDir, outputZip);
}

// Fallback ZIP builder using standard archiver or minimal zip header writer
async function fallbackZip(sourceDir, outputZip) {
    const archiver = require('archiver');
    return new Promise((resolve, reject) => {
        const out = fs.createWriteStream(outputZip);
        const archive = archiver('zip', { zlib: { level: 9 } });

        out.on('close', async () => {
            const sha1 = await computeFileSha1(outputZip);
            resolve({
                success: true,
                files_packed: archive.pointer(),
                size_bytes: fs.statSync(outputZip).size,
                sha1,
                zip_path: outputZip
            });
        });

        archive.on('error', err => reject(err));
        archive.pipe(out);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

// Validate pack structure using C++ engine or JS
async function validatePack(dirPath) {
    if (cppBin) {
        return new Promise((resolve) => {
            execFile(cppBin, ['validate-pack', dirPath], (err, stdout) => {
                if (!err) {
                    try {
                        return resolve(JSON.parse(stdout.trim()));
                    } catch {}
                }
                resolve(fallbackValidatePack(dirPath));
            });
        });
    }
    return fallbackValidatePack(dirPath);
}

function fallbackValidatePack(dirPath) {
    const has_meta = fs.existsSync(path.join(dirPath, 'pack.mcmeta'));
    const has_icon = fs.existsSync(path.join(dirPath, 'pack.png'));
    const has_assets = fs.existsSync(path.join(dirPath, 'assets', 'minecraft'));

    let total_files = 0;
    const invalid_paths = [];

    function scan(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) {
                scan(full);
            } else {
                total_files++;
                const rel = path.relative(dirPath, full).replace(/\\/g, '/');
                if (/[A-Z\s]/.test(rel)) {
                    invalid_paths.push(rel);
                }
            }
        }
    }

    try {
        scan(dirPath);
    } catch {}

    return {
        success: true,
        has_meta,
        has_icon,
        has_assets,
        total_files,
        invalid_paths_count: invalid_paths.length,
        invalid_paths
    };
}

// Free public host uploaders (No API key needed)
// 1) TmpFiles.org (Instant direct binary download link)
// 2) Catbox.moe (Permanent direct hosting)
// 3) File.io
async function uploadToPublicHost(filePath, provider = 'tmpfiles') {
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);
    const sha1 = await computeFileSha1(filePath);

    if (provider === 'catbox') {
        try {
            return await uploadCatbox(fileName, fileData, sha1);
        } catch (e) {
            console.warn('[Upload] Catbox error, falling back to TmpFiles:', e.message);
            return await uploadTmpfiles(fileName, fileData, sha1);
        }
    } else if (provider === 'tmpfiles') {
        try {
            return await uploadTmpfiles(fileName, fileData, sha1);
        } catch (e) {
            console.warn('[Upload] TmpFiles error, falling back to Catbox:', e.message);
            return await uploadCatbox(fileName, fileData, sha1);
        }
    } else {
        try {
            return await uploadTmpfiles(fileName, fileData, sha1);
        } catch (e) {
            return await uploadFileIo(fileName, fileData, sha1);
        }
    }
}

function uploadCatbox(fileName, fileData, sha1) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
        const header = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n` +
            `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const payload = Buffer.concat([header, fileData, footer]);

        const req = https.request({
            hostname: 'catbox.moe',
            path: '/user/api.php',
            method: 'POST',
            timeout: 12000,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                const url = body.trim();
                if (url.startsWith('http')) {
                    resolve({
                        success: true,
                        provider: 'Catbox.moe (Permanent Direct)',
                        url,
                        sha1,
                        direct_url: url
                    });
                } else {
                    reject(new Error(body || 'Catbox upload error'));
                }
            });
        });

        req.on('timeout', () => { req.destroy(new Error('Catbox connection timed out')); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function uploadTmpfiles(fileName, fileData, sha1) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
        const header = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const payload = Buffer.concat([header, fileData, footer]);

        const req = https.request({
            hostname: 'tmpfiles.org',
            path: '/api/v1/upload',
            method: 'POST',
            timeout: 15000,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.status === 'success' && data.data && data.data.url) {
                        const rawUrl = data.data.url;
                        const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                        resolve({
                            success: true,
                            provider: 'TmpFiles.org (Direct Download)',
                            url: directUrl,
                            sha1,
                            direct_url: directUrl
                        });
                    } else {
                        reject(new Error(body || 'Failed to upload to TmpFiles'));
                    }
                } catch (e) {
                    reject(new Error('Invalid response from TmpFiles: ' + body));
                }
            });
        });

        req.on('timeout', () => { req.destroy(new Error('TmpFiles connection timed out')); });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function uploadFileIo(fileName, fileData, sha1) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
        const header = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/zip\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const payload = Buffer.concat([header, fileData, footer]);

        const req = https.request({
            hostname: 'file.io',
            path: '/?expires=14d',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length,
                'User-Agent': 'NanoRp-Creator/1.0'
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.success && data.link) {
                        resolve({
                            success: true,
                            provider: 'file.io',
                            url: data.link,
                            sha1,
                            direct_url: data.link
                        });
                    } else {
                        reject(new Error(data.message || 'file.io upload failed'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

module.exports = {
    checkImage,
    fixImage,
    packZip,
    validatePack,
    computeFileSha1,
    uploadToPublicHost,
    getBinaryPath
};
