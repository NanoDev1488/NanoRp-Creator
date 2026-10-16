#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fetch latest Windows executable from GitHub Actions and install to Desktop.
"""
import os
import sys
import io
import shutil
import zipfile
import urllib.request
import json

class NoAuthRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req:
            for h in list(new_req.headers.keys()):
                if h.lower() == 'authorization':
                    del new_req.headers[h]
        return new_req

def fetch_and_install(run_id, desktop_path):
    token = os.environ.get("GH_TOKEN")
    if not token:
        print("[!] GH_TOKEN not set in environment")
        return False

    headers = {
        "Authorization": f"token {token}",
        "User-Agent": "NanoDev-Downloader/1.0"
    }

    # 1. Get artifacts for run
    url = f"https://api.github.com/repos/NanoDev1488/NanoRp-Creator/actions/runs/{run_id}/artifacts"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    win_artifact = None
    for a in data.get("artifacts", []):
        if "windows" in a["name"].lower():
            win_artifact = a
            break

    if not win_artifact:
        print(f"[!] No windows artifact found yet in run {run_id}")
        return False

    artifact_id = win_artifact["id"]
    print(f"[*] Found Windows artifact {artifact_id} ({win_artifact['name']}), size: {win_artifact['size_in_bytes']} bytes")

    # 2. Download zip
    download_url = f"https://api.github.com/repos/NanoDev1488/NanoRp-Creator/actions/artifacts/{artifact_id}/zip"
    opener = urllib.request.build_opener(NoAuthRedirect())
    down_req = urllib.request.Request(download_url, headers=headers)

    print("[*] Downloading artifact from GitHub/Azure...")
    with opener.open(down_req) as resp:
        zip_bytes = resp.read()

    print(f"[+] Download complete ({len(zip_bytes)} bytes). Extracting...")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        for fname in z.namelist():
            if fname.lower().endswith(".exe"):
                print(f"[+] Found executable: {fname}")
                exe_data = z.read(fname)
                with open(desktop_path, "wb") as f_out:
                    f_out.write(exe_data)
                print(f"[SUCCESS] Saved to {desktop_path} ({len(exe_data)} bytes)")
                return True

    print("[!] No .exe found inside artifact zip")
    return False

if __name__ == "__main__":
    run_id = sys.argv[1] if len(sys.argv) > 1 else "38855607712"
    desktop = os.path.expanduser("~/Desktop/NanoRp-Creator.exe")
    res = fetch_and_install(run_id, desktop)
    sys.exit(0 if res else 1)
