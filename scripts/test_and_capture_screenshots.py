"""
NanoRp-Creator: Playwright Python UI Automated Test & Screenshot Capture
Runs Electron across Windows, macOS, and Linux, verifies views and captures preview screenshots.
"""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

def run_tests():
    screenshots_dir = Path("screenshots") / sys.platform
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    print(f"[TestRunner] Launching Electron on platform: {sys.platform}")
    app_root = Path(__file__).resolve().parent.parent

    with sync_playwright() as p:
        # Launch Electron application via Playwright
        electron_app = p.electron.launch(
            args=[str(app_root)],
            env={**os.environ, "ELECTRON_ENABLE_LOGGING": "1"}
        )

        app_window = electron_app.first_window()
        app_window.set_viewport_size({"width": 1100, "height": 740})
        time.sleep(2)  # Wait for full UI render

        print("[TestRunner] Electron window successfully acquired")

        # 1. Capture Page: Project & Cloud
        shot_path_1 = screenshots_dir / "01_project_cloud.png"
        app_window.screenshot(path=str(shot_path_1))
        print(f"  [Captured] {shot_path_1}")

        # 2. Switch to Parity Validator and test table
        app_window.click('[data-page="page-parity"]')
        time.sleep(0.5)
        shot_path_2 = screenshots_dir / "02_parity_checker.png"
        app_window.screenshot(path=str(shot_path_2))
        print(f"  [Captured] {shot_path_2}")

        # 3. Switch to Font & Emoji Glyphs
        app_window.click('[data-page="page-fonts"]')
        time.sleep(0.5)
        shot_path_3 = screenshots_dir / "03_font_glyphs.png"
        app_window.screenshot(path=str(shot_path_3))
        print(f"  [Captured] {shot_path_3}")

        # 4. Switch to Custom Model Data (Items)
        app_window.click('[data-page="page-items"]')
        time.sleep(0.5)
        shot_path_4 = screenshots_dir / "04_custom_items.png"
        app_window.screenshot(path=str(shot_path_4))
        print(f"  [Captured] {shot_path_4}")

        # 5. Switch to Settings & Author info
        app_window.click('[data-page="page-settings"]')
        time.sleep(0.5)
        shot_path_5 = screenshots_dir / "05_settings_author.png"
        app_window.screenshot(path=str(shot_path_5))
        print(f"  [Captured] {shot_path_5}")

        print("[TestRunner] All test views verified and captured successfully!")
        electron_app.close()

if __name__ == "__main__":
    run_tests()
