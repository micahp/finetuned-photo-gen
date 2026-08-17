#!/usr/bin/env python3
"""Pull OpenAPI specs for FLUX 3 + all image models + any missing video models."""
import json, pathlib, urllib.parse, os, sys

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

BASE_DIR = pathlib.Path(__file__).parent.parent
OUT_DIR = BASE_DIR / "scripts" / "fal_api_specs"
OUT_DIR.mkdir(exist_ok=True)

# FLUX 3 video endpoints (new)
FLUX3 = [
    "blackforestlabs/flux-3/text-to-video",
    "blackforestlabs/flux-3/image-to-video",
    "blackforestlabs/flux-3/first-last-frame-to-video",
    "blackforestlabs/flux-3/keyframes-to-video",
    "blackforestlabs/flux-3/extend-video",
    "blackforestlabs/flux-3/text-to-video/draft",
    "blackforestlabs/flux-3/image-to-video/draft",
]

# FLUX.1 image models (not yet pulled)
FLUX_IMAGE = [
    "fal-ai/flux/schnell",
    "fal-ai/flux/dev",
    "fal-ai/flux-pro",
    "fal-ai/flux-pro/v1.1",
    "fal-ai/flux-pro/v1.1-ultra",
    "fal-ai/flux-lora",
]

# Missing video models we have in the app but not in specs
MISSING_VIDEO = [
    "fal-ai/minimax/video-01",
    "fal-ai/minimax/video-01/image-to-video",
    "fal-ai/hunyuan-custom",
    "fal-ai/hunyuan-video",
    "fal-ai/hunyuan-video/image-to-video",
    "fal-ai/ltxv-13b-098-distilled",
    "fal-ai/ltxv-13b-098-distilled/image-to-video",
]

# Image editing/transformation models the app offers via FAL
FAL_IMAGE_MORE = [
    "fal-ai/flux-pro/kontext/text-to-image",
    "fal-ai/flux-pro/kontext/max/text-to-image",
]

ALL = FLUX3 + FLUX_IMAGE + MISSING_VIDEO + FAL_IMAGE_MORE
results = {"ok": [], "failed": [], "skipped": []}

for slug in ALL:
    fname = slug.replace("/", "_") + ".json"
    fpath = OUT_DIR / fname
    if fpath.exists():
        results["skipped"].append(slug)
        print(f"SKIP (exists): {slug}")
        continue

    encoded = urllib.parse.quote_plus(slug)
    url = f"https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={encoded}"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        spec = resp.json()
        fpath.write_text(json.dumps(spec, indent=2))
        results["ok"].append(slug)
        print(f"OK: {slug} -> {fname}")
    except Exception as e:
        results["failed"].append((slug, str(e)))
        print(f"FAIL: {slug} -> {e}")

print(f"\nDone. OK: {len(results['ok'])}, SKIP: {len(results['skipped'])}, FAIL: {len(results['failed'])}")
if results["failed"]:
    print("\nFailed:")
    for s, e in results["failed"]:
        print(f"  {s}: {e}")
