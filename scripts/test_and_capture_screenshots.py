"""
NanoRp-Creator: Playwright Python Screenshot Capture & Automated Verification
Connects to Electron via Chrome DevTools Protocol (CDP) for full cross-platform compatibility.
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

def find_electron_binary(app_root: Path) -> Path:
    nm_dist = app_root / "node_modules" / "electron" / "dist"
    if sys.platform == "darwin":
        cand = nm_dist / "Electron.app" / "Contents" / "MacOS" / "Electron"
    elif sys.platform == "win32":
        cand = nm_dist / "electron.exe"
    else:
        cand = nm_dist / "electron"
        
    if cand.exists():
        return cand
    # Fallback to npx electron
    return "electron"

def run_tests():
    app_root = Path(__file__).resolve().parent.parent
    screenshots_dir = app_root / "screenshots" / (sys.platform if sys.platform != "darwin" else "macos")
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    electron_bin = find_electron_binary(app_root)
    print(f"[TestRunner] Platform: {sys.platform}")
    print(f"[TestRunner] Electron binary: {electron_bin}")

    cdp_port = 9222
    env = os.environ.copy()
    env["ELECTRON_ENABLE_LOGGING"] = "1"

    cmd = [
        str(electron_bin),
        str(app_root),
        f"--remote-debugging-port={cdp_port}",
        "--disable-gpu",
        "--no-sandbox"
    ]

    print(f"[TestRunner] Spawning Electron process: {' '.join(cmd)}")
    proc = subprocess.Popen(cmd, env=env)

    # Wait for CDP endpoint to become ready
    time.sleep(3)

    try:
        with sync_playwright() as p:
            print(f"[TestRunner] Connecting to CDP at http://127.0.0.1:{cdp_port}")
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{cdp_port}")
            
            # Locate first window page
            contexts = browser.contexts
            if not contexts or not contexts[0].pages:
                print("[TestRunner] Waiting for window page...")
                time.sleep(2)
            
            page = browser.contexts[0].pages[0]
            page.set_viewport_size({"width": 1080, "height": 720})
            time.sleep(1)

            print("[TestRunner] Successfully connected to NanoRp-Creator window")

            # 1. Capture Page: Project & Cloud
            shot1 = screenshots_dir / "01_project_cloud.png"
            page.screenshot(path=str(shot1))
            print(f"  [Captured] {shot1}")

            # 2. Switch to Parity Validator
            page.click('[data-page="page-parity"]')
            time.sleep(0.5)
            shot2 = screenshots_dir / "02_parity_checker.png"
            page.screenshot(path=str(shot2))
            print(f"  [Captured] {shot2}")

            # 3. Switch to Font & Glyphs
            page.click('[data-page="page-fonts"]')
            time.sleep(0.5)
            shot3 = screenshots_dir / "03_font_glyphs.png"
            page.screenshot(path=str(shot3))
            print(f"  [Captured] {shot3}")

            # 4. Switch to Custom Items
            page.click('[data-page="page-items"]')
            time.sleep(0.5)
            shot4 = screenshots_dir / "04_custom_items.png"
            page.screenshot(path=str(shot4))
            print(f"  [Captured] {shot4}")

            # 5. Switch to Settings & Author
            page.click('[data-page="page-settings"]')
            time.sleep(0.5)
            shot5 = screenshots_dir / "05_settings_author.png"
            page.screenshot(path=str(shot5))
            print(f"  [Captured] {shot5}")

            print("[TestRunner] All views successfully captured!")
            browser.close()
    finally:
        print("[TestRunner] Terminating Electron process")
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    run_tests()
