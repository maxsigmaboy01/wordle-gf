#!/usr/bin/env python3
"""Kept for compatibility: regenerates icon.png/icon.icns (Dino Classic) and all app icons.

The old art stays in src-tauri/icons/icon-source.png (no longer used by the build).
"""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("make_app_icons.py")), run_name="__main__")
