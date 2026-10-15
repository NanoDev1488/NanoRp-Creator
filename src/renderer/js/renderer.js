// State
let currentPackDir = '';
let currentZipPath = '';
let parityImages = []; // { path, width, height, valid, is_even_w, is_even_h, suggested_w, suggested_h }
let fontMappings = []; // { symbol, imagePath, height, ascent }
let itemMappings = []; // { baseItem, cmd, imagePath, customName }

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// Navigation Tabs
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        const targetPage = document.getElementById(item.dataset.page);
        if (targetPage) targetPage.classList.add('active');
    });
});

// Periodic RAM / Engine Stats
async function refreshStats() {
    if (!window.api || !window.api.getStats) return;
    try {
        const stats = await window.api.getStats();
        const ramLbl = document.getElementById('lbl-ram-usage');
        const engineLbl = document.getElementById('lbl-engine-status');

        if (ramLbl) {
            ramLbl.textContent = `RAM: ${stats.rssMB} MB (Heap: ${stats.heapUsedMB} MB)`;
        }
        if (engineLbl) {
            if (stats.rustActive && stats.cppActive) {
                engineLbl.textContent = 'Ядро: C++17 & Rust v1.0';
            } else if (stats.rustActive || stats.cppActive) {
                engineLbl.textContent = 'Ядро: Гибрид (Native + JS)';
            } else {
                engineLbl.textContent = 'Ядро: Ultra-Lite JS Engine';
            }
        }
    } catch {}
}
setInterval(refreshStats, 3000);
refreshStats();

// --- PAGE 1: PROJECT & CLOUD ---

document.getElementById('btn-select-folder').addEventListener('click', async () => {
    const dir = await window.api.openDirectory();
    if (dir) {
        currentPackDir = dir;
        document.getElementById('btn-select-folder').textContent = `📁 ${dir.split(/[\\/]/).pop()}`;
        document.getElementById('btn-select-folder').title = dir;
    }
});

document.getElementById('btn-generate-pack').addEventListener('click', async () => {
    if (!currentPackDir) {
        alert('Пожалуйста, сначала выберите рабочую папку ресурс-пака!');
        return;
    }

    const packData = {
        targetDir: currentPackDir,
        name: document.getElementById('inp-pack-name').value,
        packFormat: document.getElementById('sel-pack-format').value,
        description: document.getElementById('inp-pack-desc').value,
        items: itemMappings,
        fonts: fontMappings
    };

    const res = await window.api.generatePack(packData);
    if (res.success) {
        alert('✅ Структура ресурс-пака и pack.mcmeta успешно сгенерированы!');
    } else {
        alert('Ошибка генерации: ' + res.error);
    }
});

// Create ZIP
document.getElementById('btn-create-zip').addEventListener('click', async () => {
    if (!currentPackDir) {
        alert('Сначала выберите или сгенерируйте папку ресурс-пака!');
        return;
    }

    const defaultName = (document.getElementById('inp-pack-name').value || 'ResourcePack') + '.zip';
    const savePath = await window.api.saveZip(defaultName);
    if (!savePath) return;

    const btn = document.getElementById('btn-create-zip');
    btn.disabled = true;
    btn.textContent = '⏳ Упаковка...';

    try {
        const res = await window.api.createZip(currentPackDir, savePath);
        if (res.success) {
            currentZipPath = savePath;
            alert(`✅ Ресурс-пак упакован!\nФайлов: ${res.files_packed}\nРазмер: ${(res.size_bytes / 1024 / 1024).toFixed(2)} MB\nSHA-1: ${res.sha1}`);
        } else {
            alert('Ошибка упаковки: ' + res.error);
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '📦 Упаковать в ZIP';
    }
});

// Upload to Cloud
document.getElementById('btn-upload-cloud').addEventListener('click', async () => {
    let zipToUpload = currentZipPath;
    if (!zipToUpload) {
        const files = await window.api.openFiles([{ name: 'Zip Archive', extensions: ['zip'] }]);
        if (!files || files.length === 0) return;
        zipToUpload = files[0];
    }

    const provider = document.getElementById('sel-cloud-provider').value;
    const btn = document.getElementById('btn-upload-cloud');
    btn.disabled = true;
    btn.textContent = '☁️ Загрузка на хостинг...';

    try {
        const res = await window.api.uploadCloud(zipToUpload, provider);
        if (res.success) {
            const box = document.getElementById('box-cloud-result');
            box.style.display = 'flex';
            document.getElementById('res-cloud-url').textContent = res.url;
            document.getElementById('res-cloud-sha1').textContent = res.sha1;
            document.getElementById('res-server-properties').textContent =
                `resource-pack=${res.url}\nresource-pack-sha1=${res.sha1}`;
        }
    } catch (e) {
        alert('Ошибка загрузки в облако: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '☁️ Залить в Облако';
    }
});

document.getElementById('btn-copy-url').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('res-cloud-url').textContent);
    alert('Ссылка скопирована в буфер!');
});

document.getElementById('btn-copy-sha1').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('res-cloud-sha1').textContent);
    alert('SHA-1 хеш скопирован в буфер!');
});

// --- PAGE 2: PARITY VALIDATOR ---

document.getElementById('btn-scan-files').addEventListener('click', async () => {
    const files = await window.api.openFiles([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]);
    if (files && files.length > 0) {
        for (const f of files) {
            const info = await window.api.inspectImage(f);
            if (info && !parityImages.some(p => p.path === f)) {
                parityImages.push(info);
            }
        }
        renderParityTable();
    }
});

document.getElementById('btn-scan-dir').addEventListener('click', async () => {
    const dir = await window.api.openDirectory();
    if (!dir) return;

    // Trigger pack validator to scan files in directory
    const check = await window.api.validatePack(dir);
    // Add known textures
    alert(`Папка просканирована. Всего файлов: ${check.total_files}`);
});

function renderParityTable() {
    const tbody = document.getElementById('tbl-parity-body');
    const fixAllBtn = document.getElementById('btn-fix-all-images');

    if (parityImages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 32px; color: var(--ink-tertiary);">Файлы не выбраны</td></tr>`;
        fixAllBtn.style.display = 'none';
        return;
    }

    const hasOdd = parityImages.some(img => !img.valid);
    fixAllBtn.style.display = hasOdd ? 'inline-flex' : 'none';

    tbody.innerHTML = parityImages.map((img, idx) => {
        const fileName = img.path.split(/[\\/]/).pop();
        const statusBadge = img.valid
            ? `<span class="parity-badge parity-badge--even"><span class="parity-badge__dot"></span>Чётный</span>`
            : `<span class="parity-badge parity-badge--odd"><span class="parity-badge__dot"></span>Нечётный</span>`;

        const actionBtn = img.valid
            ? `<span style="color: var(--ink-muted); font-size: 11px; font-family: var(--font-mono);">OK</span>`
            : `<button class="btn btn-secondary btn-sm" onclick="fixSingleImage(${idx})">Расширить до ${img.suggested_w}×${img.suggested_h}</button>`;

        return `
            <tr>
                <td>
                    <div style="font-weight: 600; color: var(--ink-primary);">${fileName}</div>
                    <div style="font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-tertiary); overflow: hidden; text-overflow: ellipsis; max-width: 320px;">${img.path}</div>
                </td>
                <td><span style="font-family: var(--font-mono); font-variant-numeric: tabular-nums;">${img.width} × ${img.height}</span></td>
                <td>${statusBadge}</td>
                <td style="text-align: right;">${actionBtn}</td>
            </tr>
        `;
    }).join('');
}

window.fixSingleImage = async function(idx) {
    const item = parityImages[idx];
    if (!item || item.valid) return;

    const outPath = item.path; // overwrite or fix
    const res = await window.api.fixImage(item.path, outPath);
    if (res.success) {
        // Re-inspect
        const updated = await window.api.inspectImage(outPath);
        parityImages[idx] = updated;
        renderParityTable();
    }
};

document.getElementById('btn-fix-all-images').addEventListener('click', async () => {
    for (let i = 0; i < parityImages.length; i++) {
        if (!parityImages[i].valid) {
            await window.fixSingleImage(i);
        }
    }
    alert('✅ Все нечетные картинки расширены до четных размеров с сохранением пиксель-арта!');
});

// --- PAGE 3: FONTS & GLYPHS ---

document.getElementById('btn-font-browse').addEventListener('click', async () => {
    const files = await window.api.openFiles([{ name: 'Icon PNG', extensions: ['png'] }]);
    if (files && files.length > 0) {
        document.getElementById('inp-font-path').value = files[0];
    }
});

document.getElementById('btn-confirm-add-font').addEventListener('click', () => {
    const symbol = document.getElementById('inp-font-char').value.trim();
    const imagePath = document.getElementById('inp-font-path').value.trim();
    const height = parseInt(document.getElementById('inp-font-height').value, 10) || 8;
    const ascent = parseInt(document.getElementById('inp-font-ascent').value, 10) || 7;

    if (!symbol || !imagePath) {
        alert('Заполните символ и выберите файл картинки!');
        return;
    }

    fontMappings.push({ symbol, imagePath, height, ascent });
    renderFontList();
    document.getElementById('inp-font-path').value = '';
});

function renderFontList() {
    const container = document.getElementById('list-font-mappings');
    if (fontMappings.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--ink-tertiary); font-size: 12px;">Символы пока не добавлены</div>`;
        return;
    }

    container.innerHTML = fontMappings.map((f, i) => `
        <div class="mapping-card">
            <img class="mapping-thumb" src="file://${f.imagePath.replace(/\\/g, '/')}" alt="glyph">
            <div class="mapping-details">
                <div class="mapping-title">Символ: <code style="color: var(--accent);">${f.symbol}</code></div>
                <div class="mapping-meta">Размер: ${f.height}px · Подъём: ${f.ascent}px · ${f.imagePath.split(/[\\/]/).pop()}</div>
            </div>
            <button class="btn btn-danger-subtle btn-sm" onclick="removeFont(${i})">Удалить</button>
        </div>
    `).join('');
}

window.removeFont = function(index) {
    fontMappings.splice(index, 1);
    renderFontList();
};

// --- PAGE 4: CUSTOM ITEMS ---

document.getElementById('btn-item-browse').addEventListener('click', async () => {
    const files = await window.api.openFiles([{ name: 'Textures / Models', extensions: ['png', 'json'] }]);
    if (files && files.length > 0) {
        document.getElementById('inp-item-path').value = files[0];
    }
});

document.getElementById('btn-confirm-add-item').addEventListener('click', () => {
    const baseItem = document.getElementById('inp-item-base').value.trim();
    const cmd = parseInt(document.getElementById('inp-item-cmd').value, 10);
    const imagePath = document.getElementById('inp-item-path').value.trim();

    if (!baseItem || !cmd || !imagePath) {
        alert('Заполните базовый предмет, CustomModelData и выберите файл!');
        return;
    }

    itemMappings.push({ baseItem, cmd, imagePath });
    renderItemList();
    document.getElementById('inp-item-path').value = '';
    document.getElementById('inp-item-cmd').value = cmd + 1; // Auto-increment CMD for convenience
});

function renderItemList() {
    const container = document.getElementById('list-item-mappings');
    if (itemMappings.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--ink-tertiary); font-size: 12px;">Кастомные предметы не добавлены</div>`;
        return;
    }

    container.innerHTML = itemMappings.map((it, i) => `
        <div class="mapping-card">
            <img class="mapping-thumb" src="file://${it.imagePath.replace(/\\/g, '/')}" alt="item">
            <div class="mapping-details">
                <div class="mapping-title">minecraft:<b>${it.baseItem}</b></div>
                <div class="mapping-meta">CustomModelData: <span style="color: var(--accent);">${it.cmd}</span> · ${it.imagePath.split(/[\\/]/).pop()}</div>
            </div>
            <button class="btn btn-danger-subtle btn-sm" onclick="removeItem(${i})">Удалить</button>
        </div>
    `).join('');
}

window.removeItem = function(index) {
    itemMappings.splice(index, 1);
    renderItemList();
};

// --- PAGE 5: CONTACTS & EXTERNAL LINKS ---

document.getElementById('link-feedback').addEventListener('click', () => {
    window.api.openExternal('https://t.me/radoqi');
});

document.getElementById('link-channel').addEventListener('click', () => {
    window.api.openExternal('https://t.me/WineSquad');
});
