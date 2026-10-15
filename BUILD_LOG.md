# BUILD_LOG: NanoRp-Creator

## [v1.0.0] - 2026-10-15
- **Тип сборки**: Инициальный релиз и развертывание репозитория
- **Платформы**: Windows (x64), Linux (x64), macOS (x64/arm64)
- **Что сделано**:
  - Создана двухдвижковая архитектура на C++17 и Rust + Ultra-Lite Electron GUI.
  - Реализован Parity Extender: умное доращивание нечетных картинок (+1px edge clamp) без искажения пиксель-арта.
  - Добавлен визуальный редактор глифов/шрифтов без ручного редактирования `font/default.json`.
  - Добавлен визуальный менеджер кастомных предметов (CustomModelData overrides).
  - Реализована упаковка в .ZIP, расчет SHA-1 и загрузка на открытые хостинги (Catbox Litterbox, 0x0.st, file.io) без API-ключей.
  - Создан 35-этапный скрипт стриппинга и деблоатинга сборки для слабого железа.
  - Настроены GitHub Actions для мультиплатформенной сборки, Playwright-тестов со скриншотами для macOS и релиза.
- **Статус**: Готово к публикации в публичный репозиторий GitHub.
- **Патч**: Добавлен package-lock.json и requirements.txt для полноценной работы actions/cache и setup-node/setup-python на всех ОС.
- **Фикс CI & Автор**: Выставлены официальные реквизиты автора NanoDev_mc (kanalgarila3@gmail.com). Исправлен генератор CMake на Windows (подключен ilammy/msvc-dev-cmd для MSVC) и скрипт Playwright (CDP протокол) для гарантированного снятия скриншотов на macOS.
- **Единый мастер-воркфлоу**: Все 3 разрозненных workflow объединены в один главный `main.yml` ("NanoRp-Creator Pipeline") с подджобами: macOS UI Preview (Playwright), Build Matrix (Windows cmd, Ubuntu, macOS) и Publish GitHub Release. Устранён конфликт линкера на Windows.
- **Редизайн GUI (AkyRayy / Linear UI)**: Полный переход на строгий Refined Minimal дизайн (Slate, Deep Navy, Ice Sky-400), векторный SVG-набор вместо эмодзи, Data Grid с моноширинными размерами и dot-индикаторами.
- **Кроссплатформенный Debloat**: Расширен 35-этапный чистильщик (`scripts/debloat-package.js`) для рекурсивного удаления 60+ неиспользуемых локалей `*.lproj` и сопутствующих шейдеров/crashpad на macOS и Linux, снижая их размер архива с ~96 МБ до ~65 МБ.
- **Процедурная иконка (Pillow)**: Разработан процедурный скрипт `scripts/generate_icon_pil.py`. Сгенерирован изометрический ресурсный кибер-куб Minecraft с неоновыми связями в палитре Slate/Cyan. Сформированы `build/icon.ico` (16-256px для Windows), `build/icon.png` (512px) и `assets/logo.png`. Иконка подключена в BrowserWindow, electron-builder и UI.
