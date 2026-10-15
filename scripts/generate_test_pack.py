#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate complete Minecraft test resource pack with custom assets for NanoRp-Creator testing.
Location: C:\\Users\\nanodev\\Documents\\NanoRp-TestPack
"""

import os
import json
from PIL import Image, ImageDraw

TARGET_DIR = r"C:\Users\nanodev\Documents\NanoRp-TestPack"
TEXTURES_ITEM_DIR = os.path.join(TARGET_DIR, "assets", "minecraft", "textures", "item")
TEXTURES_FONT_DIR = os.path.join(TARGET_DIR, "assets", "minecraft", "textures", "font")
TEXTURES_GUI_DIR = os.path.join(TARGET_DIR, "assets", "minecraft", "textures", "gui")

os.makedirs(TEXTURES_ITEM_DIR, exist_ok=True)
os.makedirs(TEXTURES_FONT_DIR, exist_ok=True)
os.makedirs(TEXTURES_GUI_DIR, exist_ok=True)

# 1. pack.png (64x64) - Dark Slate background with glowing cyber cube & WineSquad colors
pack_img = Image.new("RGBA", (64, 64), (15, 20, 32, 255))
pdraw = ImageDraw.Draw(pack_img)

# Border
pdraw.rectangle([0, 0, 63, 63], outline=(56, 189, 248, 180), width=2)
pdraw.rectangle([3, 3, 60, 60], outline=(30, 41, 59, 255), width=1)

# Isometric mini cube
# Top face
top_pts = [(32, 14), (46, 22), (32, 30), (18, 22)]
pdraw.polygon(top_pts, fill=(56, 189, 248, 255), outline=(125, 211, 252, 255))
# Left face
left_pts = [(18, 22), (32, 30), (32, 46), (18, 38)]
pdraw.polygon(left_pts, fill=(2, 132, 199, 255), outline=(14, 165, 233, 255))
# Right face
right_pts = [(32, 30), (46, 22), (46, 38), (32, 46)]
pdraw.polygon(right_pts, fill=(12, 74, 110, 255), outline=(2, 132, 199, 255))

# Accents
pdraw.rectangle([28, 52, 36, 55], fill=(244, 63, 94, 255)) # ruby dot
pack_img.save(os.path.join(TARGET_DIR, "pack.png"))
print("[+] Created pack.png (64x64)")

# 2. odd_sword_63x64.png (63x64) - Odd width to test +1px Edge Clamp validator
odd_img = Image.new("RGBA", (63, 64), (0, 0, 0, 0))
odraw = ImageDraw.Draw(odd_img)

# Diagonal cyber katana (from 10, 52 to 50, 12)
# Blade
for i in range(32):
    x = 18 + i
    y = 44 - i
    odraw.rectangle([x, y, x + 2, y + 2], fill=(56, 189, 248, 255))
    odraw.point((x + 1, y), fill=(224, 242, 254, 255)) # highlight

# Crossguard
odraw.line([(14, 46), (24, 38)], fill=(245, 158, 11, 255), width=3)
# Hilt
odraw.line([(10, 50), (16, 44)], fill=(120, 53, 15, 255), width=3)
# Pommel
odraw.rectangle([8, 52, 11, 55], fill=(245, 158, 11, 255))

odd_img.save(os.path.join(TEXTURES_ITEM_DIR, "odd_sword_63x64.png"))
print(f"[+] Created odd_sword_63x64.png (Size: {odd_img.size})")

# 3. ruby_sword_32x32.png (32x32) - CustomModelData asset (diamond_sword override)
ruby_img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
rdraw = ImageDraw.Draw(ruby_img)

# Diagonal ruby blade
for i in range(16):
    x = 10 + i
    y = 20 - i
    rdraw.rectangle([x, y, x + 1, y + 1], fill=(225, 29, 72, 255)) # crimson
    rdraw.point((x, y), fill=(253, 164, 175, 255)) # specular light

# Guard
rdraw.line([(8, 20), (14, 16)], fill=(234, 179, 8, 255), width=2)
# Handle
rdraw.line([(5, 23), (8, 20)], fill=(88, 28, 135, 255), width=2)
# Pommel gem
rdraw.point((4, 24), fill=(244, 63, 94, 255))

ruby_img.save(os.path.join(TEXTURES_ITEM_DIR, "ruby_sword_32x32.png"))
print(f"[+] Created ruby_sword_32x32.png (Size: {ruby_img.size})")

# 4. coin_glyph_16x16.png (16x16) - Font glyph icon for :coin:
coin_img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
cdraw = ImageDraw.Draw(coin_img)

# Gold circular coin
cdraw.ellipse([1, 1, 14, 14], fill=(234, 179, 8, 255), outline=(161, 98, 7, 255))
cdraw.ellipse([3, 3, 12, 12], outline=(253, 224, 71, 255))
# Center emblem ($ / star)
cdraw.point((7, 5), fill=(161, 98, 7, 255))
cdraw.line([(6, 6), (9, 6)], fill=(161, 98, 7, 255))
cdraw.point((6, 7), fill=(161, 98, 7, 255))
cdraw.point((8, 8), fill=(161, 98, 7, 255))
cdraw.line([(6, 9), (9, 9)], fill=(161, 98, 7, 255))
cdraw.point((8, 10), fill=(161, 98, 7, 255))

coin_img.save(os.path.join(TEXTURES_FONT_DIR, "coin_glyph_16x16.png"))
print(f"[+] Created coin_glyph_16x16.png (Size: {coin_img.size})")

# 5. custom_badge_15x15.png (15x15) - Another odd size asset
badge_img = Image.new("RGBA", (15, 15), (0, 0, 0, 0))
bdraw = ImageDraw.Draw(badge_img)
bdraw.polygon([(2, 2), (12, 2), (12, 8), (7, 13), (2, 8)], fill=(139, 92, 246, 255), outline=(196, 181, 253, 255))
bdraw.point((7, 6), fill=(255, 255, 255, 255))
badge_img.save(os.path.join(TEXTURES_GUI_DIR, "custom_badge_15x15.png"))
print(f"[+] Created custom_badge_15x15.png (Size: {badge_img.size})")

# 6. pack.mcmeta
mcmeta_data = {
    "pack": {
        "pack_format": 34,
        "description": "§bNanoRp Test Resource Pack §7by §eWineSquad"
    }
}
with open(os.path.join(TARGET_DIR, "pack.mcmeta"), "w", encoding="utf-8") as f:
    json.dump(mcmeta_data, f, indent=2, ensure_ascii=False)
print("[+] Created pack.mcmeta")

# 7. ИНСТРУКЦИЯ_ТЕСТ.txt
instruction_text = """========================================================================
   ТЕСТОВЫЙ НАБОР РЕСУРС-ПАКА ДЛЯ ПРОВЕРКИ NanoRp-Creator
   Официальный канал WineSquad: t.me/WineSquad
   Разработчик: NanoDev (Nonames) | Связь: t.me/radoqi
========================================================================

Данная папка содержит готовые ассеты для мгновенного теста всех функций
приложения NanoRp-Creator (ярлык на Рабочем столе):

1. ТЕСТ ВАЛИДАТОРА НЕЧЕТНЫХ РАЗМЕРОВ (Edge Clamp +1px):
   - Файл: assets/minecraft/textures/item/odd_sword_63x64.png (размер 63x64)
   - Файл: assets/minecraft/textures/gui/custom_badge_15x15.png (размер 15x15)
   Действие в программе:
   1. Запусти NanoRp-Creator.exe с Рабочего стола.
   2. Перейди во вкладку «Валидатор & Edge Clamp».
   3. Нажми «Выбрать папку» и укажи эту папку (Documents/NanoRp-TestPack)
      или нажми «Проверить одиночный файл».
   4. Программа подсветит файл `odd_sword_63x64.png` желто-оранжевым предупреждением
      («Нечетная ширина: 63px — риск артефактов атласа в игре»).
   5. Нажми кнопку «Исправить четность (+1px)» — нативный Rust-движок автоматически
      добавит 1px прозрачной границы с клонированием краев, превратив файл в 64x64!

2. ТЕСТ СИМВОЛОВ И ГЛИФОВ (Шрифты font/default.json):
   - Файл: assets/minecraft/textures/font/coin_glyph_16x16.png (16x16, золотая монета)
   Действие в программе:
   1. Перейди во вкладку «Глифы & Шрифты».
   2. Нажми «Добавить глиф».
   3. Выбери файл `coin_glyph_16x16.png`, укажи шорткод `:coin:` или символ `\\uE001`.
   4. Нажми «Сгенерировать font JSON» — движок C++ создаст правильный Minecraft JSON.

3. ТЕСТ КАСТОМНЫХ МОДЕЛЕЙ (CustomModelData):
   - Файл: assets/minecraft/textures/item/ruby_sword_32x32.png (32x32, рубиновый меч)
   Действие в программе:
   1. Перейди во вкладку «CustomModelData».
   2. Выбери базовый предмет: `diamond_sword`.
   3. Укажи CustomModelData: `1001`.
   4. Привяжи текстуру/модель `ruby_sword_32x32`.
   5. Нажми «Сохранить overrides» — создастся правильный model predicate JSON.

4. ТЕСТ СБОРКИ И ОБЛАЧНОГО ХОСТИНГА:
   1. Перейди во вкладку «Сборка & Облако».
   2. Проверь версию Minecraft (например, 1.20.4 или 1.21).
   3. Нажми «Собрать .ZIP» — Rust Deflate архиватор соберет легковесный оптимизированный
      архив пака и мгновенно посчитает его SHA-1 хеш.
   4. Нажми «Загрузить в облако» — пак улетит на быстрый хостинг (Catbox/0x0.st)
      и сразу выдаст готовую строку для вставки в `server.properties`!

Контакты:
Канал WineSquad: https://t.me/WineSquad
Связь: https://t.me/radoqi
"""

with open(os.path.join(TARGET_DIR, "ИНСТРУКЦИЯ_ТЕСТ.txt"), "w", encoding="utf-8") as f:
    f.write(instruction_text)
print("[+] Created ИНСТРУКЦИЯ_ТЕСТ.txt")

print("\n[SUCCESS] Test pack successfully generated at: " + TARGET_DIR)
