import os
import json
from typing import List

from get_fal_models_helper_functions import FalAIHelper

# List of Pixverse v4.5 model IDs to fetch
PIXVERSE_V45_MODELS: List[str] = [
    "fal-ai/pixverse/v4.5/extend",
    "fal-ai/pixverse/v4.5/extend-fast",
    "fal-ai/pixverse/v4.5/lipsync",
    "fal-ai/pixverse/v4.5/sound-effects",
    "fal-ai/pixverse/v4.5/effects",
    "fal-ai/pixverse/v4.5/image-to-video",
    "fal-ai/pixverse/v4.5/image-to-video-fast",
    "fal-ai/pixverse/v4.5/text-to-video",
    "fal-ai/pixverse/v4.5/text-to-video-fast",
    "fal-ai/pixverse/v4.5/transition",
]


def _sanitize_model_id(model_id: str) -> str:
    """Convert a model ID into a safe filename segment."""
    return model_id.replace("/", "_").replace(".", "_")


def save_specs(helper: FalAIHelper, output_dir: str = None) -> None:
    """Fetch and save OpenAPI specs for all Pixverse v4.5 variants."""
    if output_dir is None:
        # Default to the fal_api_specs directory next to this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, "fal_api_specs")

    os.makedirs(output_dir, exist_ok=True)

    for model_id in PIXVERSE_V45_MODELS:
        print(f"Fetching spec for {model_id} ...")
        info = helper.get_model_info(model_id)
        spec = info.get("openapi_spec")

        if spec is None:
            print(f"[WARN] No spec returned for {model_id}. Skipping save.")
            continue

        filename = f"fal-ai_{_sanitize_model_id(model_id)}.json"
        filepath = os.path.join(output_dir, filename)

        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(spec, f, indent=2)
            print(f"Saved spec to {filepath}")
        except Exception as exc:
            print(f"[ERROR] Failed to write {filepath}: {exc}")


if __name__ == "__main__":
    helper = FalAIHelper()
    save_specs(helper) 