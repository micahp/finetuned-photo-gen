#!/usr/bin/env python3
"""grab_fal_params.py – Harvest Fal.ai UI parameter grouping for each entry in our VIDEO_MODELS list.

Usage:
  python scripts/grab_fal_params.py path/to/video-models.ts [-o OUTPUT]

Given the TypeScript source that exports the VIDEO_MODELS array, the script:
1. Extracts `(id, falModelId)` pairs with a lightweight regex (good enough for our current code style).
2. Calls each model's `/api` page and scrapes the **Input** schema section for field names.
3. Splits fields into "above-the-fold" vs. "advanced" according to Fal's UI rule (first ~5 core controls).
4. Prints a JSON mapping or writes it to `--output` if provided.

This keeps our param grouping in sync with Fal's ever-changing model page layouts.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.parse import quote

import requests

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def api_url(slug: str) -> str:
    """Return the Fal.ai `/api` URL for a given model slug."""
    parts = [quote(p, safe="") for p in slug.lstrip("/").split("/")]
    return f"https://fal.ai/models/{'/'.join(parts)}/api"


def scrape_inputs(url: str) -> List[str]:
    """Scrape the field names from the ### Input section of the Fal API page."""
    try:
        html = requests.get(url, timeout=20).text
    except Exception as exc:
        raise RuntimeError(f"request error: {exc}") from exc

    block = re.search(r"### Input#?[^#]+?(?=### Output|## Related)", html, re.S)
    if not block:
        raise ValueError("Could not locate Input block in page")

    return re.findall(r"<code[^>]*>([a-z0-9_]+)</code>", block.group(0))


def split_folds(fields: List[str]) -> Tuple[List[str], List[str]]:
    """Return (above, advanced) according to Fal’s ordering rule."""
    above, advanced = [], []
    core_names = {
        "prompt",
        "image_url",
        "video_url",
        "aspect_ratio",
        "resolution",
        "duration",
        "fps",
    }
    for idx, name in enumerate(fields):
        if idx <= 4 or name in core_names:
            above.append(name)
        else:
            advanced.append(name)
    return above, advanced


def parse_ts_models(ts_path: Path) -> List[Dict[str, str]]:
    """Extract (id, falModelId) pairs from the TypeScript VIDEO_MODELS array."""
    text = ts_path.read_text(encoding="utf-8")
    # Very loose but sufficient regex spanning inside each object literal
    pattern = re.compile(r"id:\s*'([^']+)'[^{}]+?falModelId:\s*'([^']+)'", re.S)
    pairs = pattern.findall(text)
    if not pairs:
        raise ValueError("No model definitions found – regex may need updating.")
    return [{"id": mid, "falModelId": slug} for mid, slug in pairs]


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def main(argv: List[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Harvest Fal input parameter groupings.")
    parser.add_argument("ts_file", type=Path, help="Path to src/lib/video-models.ts")
    parser.add_argument("-o", "--output", type=Path, help="Write JSON to this file instead of stdout")
    args = parser.parse_args(argv)

    models = parse_ts_models(args.ts_file)
    results: Dict[str, Dict[str, List[str]]] = {}

    for m in models:
        slug = m["falModelId"]
        url = api_url(slug)
        try:
            fields = scrape_inputs(url)
            above, advanced = split_folds(fields)
            results[m["id"]] = {"above": above, "advanced": advanced}
        except Exception as exc:
            results[m["id"]] = {"error": str(exc)}

    json_blob = json.dumps(results, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(json_blob, encoding="utf-8")
        print(f"Wrote results to {args.output.relative_to(Path.cwd())}")
    else:
        print(json_blob)


if __name__ == "__main__":  # pragma: no cover
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1) 