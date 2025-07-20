import json, textwrap, pathlib

# Define list of (label, slug) tuples – 35 total
endpoints = [
    ("Pixverse v4.5 T2V", "fal-ai/pixverse/v4.5/text-to-video"),
    ("Pixverse v4.5 I2V effects", "fal-ai/pixverse/v4.5/effects"),
    ("WAN 2.1 I2V", "fal-ai/wan-i2v"),
    ("WAN 2.1 T2V", "fal-ai/wan-t2v"),
    ("Hailuo‑02 Std I2V", "fal-ai/minimax/hailuo-02/standard/image-to-video"),
    ("Hailuo‑02 Pro I2V", "fal-ai/minimax/hailuo-02/pro/image-to-video"),
    ("Seedance 1.0 Lite T2V", "fal-ai/bytedance/seedance/v1/lite/text-to-video"),
    ("Seedance 1.0 Pro T2V", "fal-ai/bytedance/seedance/v1/pro/text-to-video"),
    ("Stable Video Diffusion I2V", "fal-ai/stable-video"),
    ("Fast‑SVD LCM I2V", "fal-ai/fast-svd-lcm"),
    ("Fast‑SVD T2V", "fal-ai/fast-svd"),
    ("LTX Video (preview) I2V", "fal-ai/ltx-video/image-to-video"),
    ("LTX Video 0.9.5 T2V", "fal-ai/ltx-video-v095"),
    ("LTX Video 13B dev I2V", "fal-ai/ltx-video-13b-dev/image-to-video"),
    ("LTX Video 13B Distilled", "fal-ai/ltx-video-13b-distilled/multiconditioning"),
    ("MAGI‑1 I2V", "fal-ai/magi/image-to-video"),
    ("MAGI‑1 Extend V2V", "fal-ai/magi/extend-video"),
    ("MiniMax Video‑01 T2V", "fal-ai/minimax/video-01/text-to-video"),
    ("MiniMax Video‑01 Live I2V", "fal-ai/minimax/video-01/live/image-to-video"),
    ("Kling 2.1 Pro I2V", "fal-ai/kling-video/v2.1/pro/image-to-video"),
    ("Kling 2.1 Master I2V", "fal-ai/kling-video/v2.1/master/image-to-video"),
    ("Kling 2 Master (legacy)", "fal-ai/kling-video/v2/master/image-to-video"),
    ("Kling 1.6 Pro I2V", "fal-ai/kling-video/v1.6/pro/image-to-video"),
    ("Veo 3 T2V", "fal-ai/veo3"),
    ("Veo 3 Fast T2V", "fal-ai/veo3/fast"),
    ("Veo 2 T2V", "fal-ai/veo2"),
    ("Veo 2 I2V", "fal-ai/veo2/image-to-video"),
    ("Hunyuan Video T2V", "fal-ai/hunyuan-video"),
    ("Hunyuan Custom T2V", "fal-ai/hunyuan-video/custom"),
    ("Hunyuan Avatar T2V", "fal-ai/hunyuan-avatar"),
    ("LTX 0.9.5 Multi‑conditioning", "fal-ai/ltx-video-v095/multiconditioning"),
    ("LTX 13B dev Extend", "fal-ai/ltx-video-13b-dev/extend"),
    ("LTX preview I2V (dup)", "fal-ai/ltx-video/image-to-video/api"),
    ("Fast‑SVD LCM I2V (dup)", "fal-ai/fast-svd-lcm/api"),
    ("Stable Video Diffusion T2V", "fal-ai/stable-video/t2v")
]

# Save endpoints JSON
BASE_DIR = pathlib.Path(__file__).parent
endpoints_path = BASE_DIR / "fal_api_endpoints_35.json"
with open(endpoints_path, "w") as f:
    json.dump(endpoints, f, indent=2)

# Create fetch script
script_code = textwrap.dedent("""
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
""")
script_path = BASE_DIR / "fetch_fal_api_specs.py"
with open(script_path, "w") as f:
    f.write(script_code)

# Let user download
print("Created files: endpoints list and fetch script.")
