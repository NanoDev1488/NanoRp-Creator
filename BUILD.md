# Инструкция по сборке NanoRp-Creator

## Окружение
- Node.js 18+ LTS
- Python 3.10+ (для Playwright тестов)
- Rust Toolchain & Cargo (для нативного rust-engine)
- CMake 3.15+ и компилятор C++17 (MSVC / GCC / Clang)

## Локальная сборка (Windows / cmd)
```cmd
:: 1. Установка зависимостей
npm install

:: 2. Сборка нативного Rust движка (опционально)
cargo build --release --manifest-path native\rust-engine\Cargo.toml

:: 3. Сборка нативного C++ движка (опционально)
cmake -B native\cpp-engine\build -S native\cpp-engine -DCMAKE_BUILD_TYPE=Release
cmake --build native\cpp-engine\build --config Release

:: 4. Запуск в режиме разработки
npm start

:: 5. Сборка упакованного .exe с 35-этапным деблоатингом
npm run dist:win
```

## Сборка в GitHub Actions
- Все этапы компиляции под Windows, Linux и macOS автоматизированы в `.github/workflows/build.yml`.
- Кэш Cargo, NPM и CMake переиспользуется между запусками.
- Релизы формируются автоматически при пуше тега `v*` через `.github/workflows/release.yml`.
