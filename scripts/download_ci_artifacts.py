#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import io
import shutil
import zipfile
import urllib.request

class NoAuthRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req:
            # Strip Authorization header when redirected to external Azure Blob Storage
            for h in list(new_req.headers.keys()):
                if h.lower() == 'authorization':
                    del new_req.headers[h]
        return new_req

def download_artifact(artifact_id, out_dir):
    token = os.environ.get("GH_TOKEN")
    if not token:
        print("[!] GH_TOKEN not set")
        sys.exit(1)

    url = f"https://api.github.com/repos/NanoDev1488/NanoRp-Creator/actions/artifacts/{artifact_id}/zip"
    opener = urllib.request.build_opener(NoAuthRedirect())
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"token {token}",
            "User-Agent": "NanoDev-CI-Downloader/1.0"
        }
    )

    print(f"[*] Downloading artifact {artifact_id}...")
    with opener.open(req) as resp:
        data = resp.read()

    print(f"[+] Downloaded {len(data)} bytes. Extracting to {out_dir}...")
    os.makedirs(out_dir, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(out_dir)
        print("[+] Extracted:", z.namelist())

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: download_ci_artifacts.py <artifact_id> <target_dir>")
        sys.exit(1)
    download_artifact(sys.argv[1], sys.argv[2])
