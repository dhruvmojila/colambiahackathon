"""
download_model.py
─────────────────
Run this ONCE before building your Docker image to pull
the WLASL-300 I3D checkpoint from the official repository.

Usage:
    python download_model.py

The script writes  wlasl_model.pth  into the current directory.
"""

import os
import sys
import urllib.request

# ── Option A: direct GitHub release asset (update URL if repo changes) ──────
# From dxli94/WLASL → pretrained weights hosted as a release asset.
WLASL_MODEL_URLS = [
    # Primary: official WLASL pretrained I3D weights (100 classes)
    "https://github.com/dxli94/WLASL/raw/master/code/I3D/weights/asl100.pth.tar",
    # Fallback: community re-upload on HuggingFace (300 classes)
    # Swap this to your own GCS bucket if you have a 300-class fine-tune.
]

OUTPUT_FILE = "wlasl_model.pth"


def download(url: str, dest: str):
    print(f"Downloading from:\n  {url}")
    print(f"Saving to: {dest}\n")

    def progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            pct = min(downloaded / total_size * 100, 100)
            bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
            print(f"\r[{bar}] {pct:.1f}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=progress)
    print("\nDone.\n")


if __name__ == "__main__":
    if os.path.exists(OUTPUT_FILE):
        print(f"✅  {OUTPUT_FILE} already exists. Delete it to re-download.")
        sys.exit(0)

    for url in WLASL_MODEL_URLS:
        try:
            download(url, OUTPUT_FILE)
            print(f"✅  Checkpoint saved as {OUTPUT_FILE}")
            print("\n⚠️   NOTE: This is the 100-class WLASL checkpoint.")
            print("    If you want 300 classes, replace wlasl_model.pth with the")
            print("    appropriate checkpoint and update NUM_CLASSES in main.py.\n")
            break
        except Exception as e:
            print(f"Failed ({e}). Trying next URL …")
    else:
        print("❌  All download attempts failed.")
        print("    Manually download from https://github.com/dxli94/WLASL")
        print("    and place the .pth file as wlasl_model.pth in this folder.")
        sys.exit(1)
