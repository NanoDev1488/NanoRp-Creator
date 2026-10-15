# PROJECT_STATE: NanoRp-Creator

## 1. О проекте
- **Название**: NanoRp-Creator (v1.0.0)
- **Автор**: NanoDev (Nonames). Обратная связь: t.me/radoqi, Канал: t.me/WineSquad
- **Назначение**: Ультралегкая кроссплатформенная студия ресурс-паков Minecraft с умным выравниванием четности пикселей (кратность 2), заменой глифов шрифта, CustomModelData и облачным линкером без API-ключей.

## 2. Стек и Архитектура
- **GUI**: Electron (Chromium c CPU-only профилем, флаги экономии ОЗУ, 40-50 МБ RAM).
- **Core 1 (Rust)**: `native/rust-engine` — проверка четности, алгоритм умного расширения пикселей (+1px edge clamp), ZIP-архивирование, SHA-1 хеш.
- **Core 2 (C++17)**: `native/cpp-engine` — парсинг, валидация путей Minecraft, генерация mcmeta, font и model overrides JSON.
- **Node Bridge**: `src/main/native-bridge.js` — прозрачный гибридный мост с авто-переключением (Native бинарники -> Pure JS Fallback).

## 3. Что сделано
- [x] Полноценный интерфейс в голубо-сине-сером дизайне (Slate / Deep Blue).
- [x] Движок валидации и выравнивания нечетных размеров картинок (63x64 -> 64x64) в 1 клик.
- [x] Визуальный редактор шрифтов и глифов (font/default.json) без ручной возни с JSON.
- [x] Конфигуратор кастомных предметов и CustomModelData.
- [x] Авто-генератор pack.mcmeta под все версии Minecraft (1.6 - 1.21.x+).
- [x] Облачный загрузчик на открытые хостинги (Catbox Litterbox, 0x0.st, file.io) с выводом для server.properties.
- [x] 35-этапный скрипт стриппинга и деблоатинга сборки (`scripts/debloat-package.js`).
- [x] CI/CD в GitHub Actions для Windows, Linux, macOS с кэшированием (cargo, npm, cmake).
- [x] Playwright (Python) тесты со снятием скриншотов на macOS.
- [x] Release Action со ссылкой на чейнджлог.
- [x] Релиз v1.0.0 успешно скомпилирован на всех ОС, артефакт NanoRp-Creator.exe скачан на рабочий стол пользователя (C:\Users\nanodev\Desktop\NanoRp-Creator.exe, ~64.8 МБ).
- [x] Оформление README.md в плиточном стиле с карточками и контактами автора.

## 4. Правила окружения
- Windows 10, 4 ГБ ОЗУ, слабый процессор: сборка только через cmd, никакого PowerShell.
- Секреты (токены) передаются только в cmd окружении, не сохраняются в файлы.
