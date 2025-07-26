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
import time
from pathlib import Path
from typing import Dict, List, Tuple, Iterable
from urllib.parse import quote

# Third-party dependencies (install via pip):
#   pip install cloudscraper beautifulsoup4
# cloudscraper is only required when falling back to remote scraping.
# Make the dependency optional so local spec harvesting works without it.
try:
    import cloudscraper  # type: ignore
except ModuleNotFoundError:
    cloudscraper = None  # noqa: N816  (lowercase needed for attr access later)

# BeautifulSoup remains an optional fallback but primary extraction now
# uses regex because Fal pages serve raw markdown with back-ticked names
# prior to hydration.
from bs4 import BeautifulSoup
# ---------------------------------------------------------------------------
# Local OpenAPI spec fallback
# ---------------------------------------------------------------------------

SPEC_DIR = Path(__file__).parent / "fal_api_specs"


def spec_file_for_slug(slug: str) -> Path:
    """Return the JSON spec path for a given Fal model slug, if it exists locally."""
    # e.g. 'fal-ai/bytedance/seedance/v1/lite/text-to-video' →
    #       'fal-ai_bytedance_seedance_v1_lite_text-to-video.json'
    fname = slug.replace("/", "_") + ".json"
    return SPEC_DIR / fname


def extract_fields_from_spec(spec_path: Path) -> List[str] | None:
    """Extract parameter names from a local OpenAPI JSON spec file.

    Returns list of field names in the order they appear in the JSON file.
    If no suitable *Input* schema exists, returns None.
    """
    if not spec_path.exists():
        return None

    try:
        data = json.loads(spec_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    schemas = data.get("components", {}).get("schemas", {})
    for name, schema in schemas.items():
        if name.lower().endswith("input") and isinstance(schema, dict):
            props = schema.get("properties")
            if isinstance(props, dict):
                # Preserve key order as in the JSON file (Python 3.7+ preserves)
                return list(props.keys())
    return None


# ---------------------------------------------------------------------------
# HTTP client (Cloudflare-aware)
# ---------------------------------------------------------------------------


UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

if cloudscraper is not None:
    # cloudscraper v1.2.71 expects `browser` as a dict describing platform.
    # Use a Chrome desktop UA on macOS to mimic real traffic.
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "desktop": True},
        delay=1,
    )
    scraper.headers.update({"User-Agent": UA})

# polite rate-limit between requests (seconds)
REQUEST_DELAY = 0.8

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def api_url(slug: str) -> str:
    """Return the Fal.ai `/api` URL for a given model slug."""
    parts = [quote(p, safe="") for p in slug.lstrip("/").split("/")]
    return f"https://fal.ai/models/{'/'.join(parts)}/api"


def candidate_urls(slug: str, mode: str) -> Iterable[str]:
    """Yield possible /api URLs for a given slug covering common Fal variants."""
    base = f"https://fal.ai/models/{slug}"
    yield f"{base}/api"  # as-is (may redirect internally)

    if not slug.endswith(('/image-to-video', '/text-to-video', '/video-to-video')):
        variant = 'image-to-video' if mode == 'image-to-video' else 'text-to-video'
        yield f"{base}/{variant}/api"
        # Sometimes there is an extend/video-to-video variant
        yield f"{base}/video-to-video/api"


def fetch_html(url: str) -> str | None:
    """Return HTML for url if it contains an Input schema section."""
    if cloudscraper is None:
        return None
    try:
        r = scraper.get(url, timeout=20)  # type: ignore[attr-defined]
        if r.ok and ('schema-input' in r.text or '### Input' in r.text):
            return r.text
    except Exception:
        pass
    return None


def extract_fields(html: str) -> List[str]:
    """Extract parameter names from the raw markdown HTML.

    Fal pages send the markdown pre-hydration, so the back-ticked
    parameter names remain as literal text. A simple regex pull between
    the *Input* heading and the next heading is the most resilient.
    """

    block_match = re.search(
        r"#+\s*Input#?(.+?)(?=#+\s*(Output|Other|About|LLMs|Table))",
        html,
        flags=re.I | re.S,
    )
    if not block_match:
        raise ValueError("No Input section found")

    raw_block = block_match.group(0)
    fields = re.findall(r"`([A-Za-z0-9_]+)`", raw_block)

    # Fallback: if regex somehow fails (HTML already hydrated), try <code>
    if not fields:
        soup = BeautifulSoup(raw_block, "html.parser")
        fields = [c.get_text(strip=True) for c in soup.select("code")]

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_fields: list[str] = []
    for f in fields:
        if f not in seen:
            seen.add(f)
            unique_fields.append(f)
    return unique_fields


CORE_NAMES = {
    'prompt',
    'image_url',
    'video_url',
    'aspect_ratio',
    'resolution',
    'duration',
    'fps',
}


def split_folds(fields: List[str]) -> Tuple[List[str], List[str]]:
    """Return (above, advanced) according to Fal’s ordering rule."""
    above: list[str] = []
    for idx, name in enumerate(fields):
        if idx < 6 or name in CORE_NAMES:
            above.append(name)
        else:
            break
    advanced = [f for f in fields if f not in above]
    return above, advanced


# ---------------------------------------------------------------------------------
# Parsing TypeScript VIDEO_MODELS array for (id, falModelId, mode)
# ---------------------------------------------------------------------------------


def parse_ts_models(ts_path: Path) -> List[Dict[str, str]]:
    """Extract (id, falModelId) pairs from the TypeScript VIDEO_MODELS array."""
    text = ts_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"id:\s*'(?P<id>[^']+)'[\s\S]+?falModelId:\s*'(?P<falModelId>[^']+)'[\s\S]+?mode:\s*'(?P<mode>[^']+)'",
        re.S,
    )
    raw = [m.groupdict() for m in pattern.finditer(text)]
    if not raw:
        raise ValueError('No model definitions found – update regex parsing.')
    return raw


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def main(argv: List[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Harvest Fal input parameter groupings.")
    parser.add_argument("ts_file", type=Path, help="Path to src/lib/video-models.ts")
    parser.add_argument("-o", "--output", type=Path, help="Write JSON to this file instead of stdout")
    parser.add_argument("--limit", nargs="*", help="Restrict to these model ids during debugging")
    args = parser.parse_args(argv)

    models = parse_ts_models(args.ts_file)

    if args.limit:
        wanted = set(args.limit)
        models = [m for m in models if m["id"] in wanted]

    results: Dict[str, Dict[str, List[str]]] = {}

    for m in models:
        # Step 1: Try local spec file
        fields: List[str] | None = None
        spec_path = spec_file_for_slug(m['falModelId'])
        fields = extract_fields_from_spec(spec_path)

        if fields:
            # Successfully extracted from local spec
            source = "spec"
        else:
            # Step 2: Fallback to remote scraping
            last_error = None
            for url in candidate_urls(m['falModelId'], m['mode']):
                html = fetch_html(url)
                if html is None:
                    continue
                try:
                    fields = extract_fields(html)
                    source = "remote"
                    break
                except Exception as exc:
                    last_error = str(exc)

            if not fields:
                print(f"{m['id']}: ✗ {last_error or 'Input section not found'}")
                time.sleep(REQUEST_DELAY)
                # Skip this model – an incomplete mapping is better than crashing the UI.
                continue

        above, advanced = split_folds(fields)
        results[m['id']] = {'above': above, 'advanced': advanced}
        print(f"{m['id']}: ✓ {len(fields)} fields ({source})")

        # Only delay when hitting remote network
        if source == "remote":
            time.sleep(REQUEST_DELAY)

    json_blob = json.dumps(results, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(json_blob, encoding='utf-8')
        print(f"Wrote results to {args.output}")
    else:
        print(json_blob)


if __name__ == "__main__":  # pragma: no cover
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1) 