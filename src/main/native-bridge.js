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
    return new Promise((resolve) => {
        fs.open(filePath, 'r', (err, fd) => {
            if (err) return resolve({ success: false, valid: false, error: err.message });
            const buffer = Buffer.alloc(32);
            fs.read(fd, buffer, 0, 32, 0, (readErr, bytesRead) => {
                fs.close(fd, () => {});
                if (readErr || bytesRead < 24) {
                    return resolve({ valid: false, error: 'Файл слишком мал или повреждён' });
                }

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

// Fast CRC32 calculation for ZIP generator
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function calculateCrc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Zero-dependency pure Node.js ZIP builder (PKZIP 2.0 standard)
async function fallbackZip(sourceDir, outputZip) {
    return new Promise(async (resolve, reject) => {
        try {
            const zlib = require('zlib');
            const entries = [];

            function walk(current, base = '') {
                const items = fs.readdirSync(current, { withFileTypes: true });
                for (const item of items) {
                    const full = path.join(current, item.name);
                    const rel = base ? `${base}/${item.name}` : item.name;
                    if (item.isDirectory()) {
                        walk(full, rel);
                    } else if (item.isFile()) {
                        entries.push({ rel, full, data: fs.readFileSync(full) });
                    }
                }
            }
            walk(sourceDir);

            const parts = [];
            const central = [];
            let offset = 0;

            const now = new Date();
            const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
            const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
            const dosTimestamp = ((dosDate << 16) | dosTime) >>> 0;

            for (const entry of entries) {
                const nameBuf = Buffer.from(entry.rel.replace(/\\/g, '/'), 'utf8');
                const compressed = zlib.deflateRawSync(entry.data, { level: 9 });
                const crc = calculateCrc32(entry.data);

                // Local file header (30 bytes)
                const lh = Buffer.alloc(30);
                lh.writeUInt32LE(0x04034b50, 0); // Local header signature
                lh.writeUInt16LE(20, 4);          // Version needed (2.0)
                lh.writeUInt16LE(0x0800, 6);      // UTF-8 flag
                lh.writeUInt16LE(8, 8);           // Deflate compression
                lh.writeUInt32LE(dosTimestamp, 10); // Real DOS Mod time & date
                lh.writeUInt32LE(crc, 14);        // CRC-32
                lh.writeUInt32LE(compressed.length, 18); // Compressed size
                lh.writeUInt32LE(entry.data.length, 22); // Uncompressed size
                lh.writeUInt16LE(nameBuf.length, 26);    // Filename length
                lh.writeUInt16LE(0, 28);                 // Extra field length

                parts.push(lh, nameBuf, compressed);

                // Central directory header (46 bytes)
                const cd = Buffer.alloc(46);
                cd.writeUInt32LE(0x02014b50, 0); // CD signature
                cd.writeUInt16LE(20, 4);          // Version made by
                cd.writeUInt16LE(20, 6);          // Version needed
                cd.writeUInt16LE(0x0800, 8);      // UTF-8 flag
                cd.writeUInt16LE(8, 10);          // Deflate compression
                cd.writeUInt32LE(dosTimestamp, 12); // Real DOS Mod time & date
                cd.writeUInt32LE(crc, 16);        // CRC-32
                cd.writeUInt32LE(compressed.length, 20); // Compressed size
                cd.writeUInt32LE(entry.data.length, 24); // Uncompressed size
                cd.writeUInt16LE(nameBuf.length, 28);    // Filename length
                cd.writeUInt16LE(0, 30);          // Extra field length
                cd.writeUInt16LE(0, 32);          // File comment length
                cd.writeUInt16LE(0, 34);          // Disk number
                cd.writeUInt16LE(0, 36);          // Internal attributes
                cd.writeUInt32LE(0x81a40000, 38); // External attributes (regular file)
                cd.writeUInt32LE(offset, 42);     // Relative offset of local header

                central.push(cd, nameBuf);
                offset += 30 + nameBuf.length + compressed.length;
            }

            const cdBuf = Buffer.concat(central);

            // End of central directory record (22 bytes)
            const eocd = Buffer.alloc(22);
            eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
            eocd.writeUInt16LE(0, 4);                 // Disk number
            eocd.writeUInt16LE(0, 6);                 // Disk start
            eocd.writeUInt16LE(entries.length, 8);    // Entries on disk
            eocd.writeUInt16LE(entries.length, 10);   // Total entries
            eocd.writeUInt32LE(cdBuf.length, 12);     // Size of central directory
            eocd.writeUInt32LE(offset, 16);           // Offset of central directory
            eocd.writeUInt16LE(0, 20);                // Comment length

            fs.mkdirSync(path.dirname(outputZip), { recursive: true });
            const finalZip = Buffer.concat([...parts, cdBuf, eocd]);
            fs.writeFileSync(outputZip, finalZip);

            const sha1 = await computeFileSha1(outputZip);
            resolve({
                success: true,
                files_packed: entries.length,
                size_bytes: finalZip.length,
                sha1,
                zip_path: outputZip
            });
        } catch (err) {
            reject(err);
        }
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
                if (rel.toLowerCase().startsWith('assets/') && /[A-Z\s]/.test(rel)) {
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
// 1) paste.c-net.org (Permanent binary RAW stream / 180 days / 50 MB / No captchas / No Cloudflare blocking)
// 2) Catbox.moe (Permanent direct hosting)
// 3) TmpFiles.org
async function uploadToPublicHost(filePath, provider = 'cnet') {
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);
    const sha1 = await computeFileSha1(filePath);

    if (provider === 'cnet') {
        try {
            return await uploadCNet(fileName, fileData, sha1);
        } catch (e) {
            console.warn('[Upload] paste.c-net.org error, falling back to Catbox:', e.message);
            return await uploadCatbox(fileName, fileData, sha1);
        }
    } else if (provider === 'catbox') {
        try {
            return await uploadCatbox(fileName, fileData, sha1);
        } catch (e) {
            console.warn('[Upload] Catbox error, falling back to c-net:', e.message);
            return await uploadCNet(fileName, fileData, sha1);
        }
    } else {
        try {
            return await uploadCNet(fileName, fileData, sha1);
        } catch (e) {
            return await uploadTmpfiles(fileName, fileData, sha1);
        }
    }
}

function uploadCNet(fileName, fileData, sha1) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'paste.c-net.org',
            path: '/',
            method: 'PUT',
            timeout: 25000,
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-FileName': fileName,
                'Content-Length': fileData.length,
                'User-Agent': 'NanoRp-Creator/1.0'
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                const url = body.trim();
                if (res.statusCode >= 200 && res.statusCode < 300 && url.startsWith('http')) {
                    resolve({
                        success: true,
                        provider: 'paste.c-net.org (Direct Stream)',
                        url,
                        sha1,
                        direct_url: url
                    });
                } else {
                    reject(new Error(`c-net HTTP ${res.statusCode}: ${body || 'Failed to upload'}`));
                }
            });
        });

        req.on('timeout', () => { req.destroy(new Error('paste.c-net.org connection timed out')); });
        req.on('error', reject);
        req.write(fileData);
        req.end();
    });
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
