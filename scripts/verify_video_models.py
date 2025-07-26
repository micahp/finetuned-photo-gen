import re
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import sys

# Ensure project root is on PYTHONPATH so that 'scripts.' package imports work
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.get_fal_models_helper_functions import FalAIHelper

VIDEO_MODELS_TS_PATH = Path(__file__).resolve().parent.parent / "src" / "lib" / "video-models.ts"

MODEL_START_RE = re.compile(r"^\s*{\s*$")
ID_RE = re.compile(r"id:\s*'([^']+)'")
FAL_ID_RE = re.compile(r"falModelId:\s*'([^']+)'")
COST_RE = re.compile(r"costPerSecond:\s*(\d+(?:\.\d+)?)")
MODEL_END_RE = re.compile(r"^\s*},?\s*$")


def parse_models(file_path: Path) -> List[Dict[str, Any]]:
    """Quick-and-dirty extractor for VIDEO_MODELS definitions."""
    models: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    with file_path.open() as f:
        for line in f:
            if MODEL_START_RE.match(line):
                current = {}
                continue
            if m := ID_RE.search(line):
                current["id"] = m.group(1)
            if m := FAL_ID_RE.search(line):
                current["falModelId"] = m.group(1)
            if m := COST_RE.search(line):
                current["costPerSecond"] = float(m.group(1))
            if MODEL_END_RE.match(line) and current:
                # Only append if we captured falModelId (signals a full model entry)
                if "falModelId" in current:
                    models.append(current)
                current = {}
    return models


def price_to_credits(price_usd_per_second: float, credit_usd_value: float = 0.01) -> float:
    """Convert USD price per second to internal credits assuming 1 credit == credit_usd_value USD."""
    return price_usd_per_second / credit_usd_value


def main():
    helper = FalAIHelper()
    models = parse_models(VIDEO_MODELS_TS_PATH)
    results: List[Dict[str, Any]] = []
    for m in models:
        fal_id = m["falModelId"]
        model_info = helper.get_model_info(fal_id)
        openapi_valid = "openapi_spec" in model_info and model_info.get("openapi_spec") is not None

        pricing_info = model_info.get("pricing", {})
        match_status = "unknown"
        expected_credits: Optional[float] = None
        if pricing_info.get("unit") == "video_second" and isinstance(pricing_info.get("price"), (int, float)):
            expected_credits = round(price_to_credits(pricing_info["price"]), 2)
            diff = m["costPerSecond"] - expected_credits
            match_status = "OK" if abs(diff) < 1e-2 else "MISMATCH"
        results.append({
            "id": m["id"],
            "falModelId": fal_id,
            "openapiValid": openapi_valid,
            "codedCost": m["costPerSecond"],
            "pricing": pricing_info,
            "expectedCredits": expected_credits,
            "status": match_status,
        })

    # Output JSON summary for easy consumption
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main() 