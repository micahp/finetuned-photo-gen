
import json, requests, urllib.parse, pathlib, os

BASE_DIR = pathlib.Path(__file__).parent
# Load endpoints
with open(BASE_DIR / 'fal_api_endpoints_35.json', 'r') as f:
    endpoints = json.load(f)

out_dir = BASE_DIR / 'fal_api_specs'
out_dir.mkdir(exist_ok=True)

for label, slug in endpoints:
    encoded = urllib.parse.quote_plus(slug)
    url = f"https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={encoded}"
    print(f"Fetching {label} -> {url}")
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        spec = resp.json()
        fname = out_dir / f"{slug.replace('/', '_')}.json"
        fname.write_text(json.dumps(spec, indent=2))
        print("  saved to", fname)
    except Exception as e:
        print("  ERROR:", e)

print("\nDone. All specs saved in", out_dir)
