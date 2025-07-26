import requests
import json
from typing import Dict, List, Optional, Any
from urllib.parse import quote

class FalAIHelper:
    def __init__(self):
        self.base_url = "https://fal.ai"
        self.api_base_url = "https://queue.fal.run"
        self.openapi_base = "https://fal.ai/api/openapi/queue/openapi.json"
        
        # Categories discovered from fal.ai/models
        self.categories = {
            "audio-to-audio": 6,
            "audio-to-video": 1, 
            "image-to-3d": 13,
            "image-to-image": 209,
            "image-to-json": 1,
            "image-to-video": 82,
            "json": 3,
            "large-language-models": 3,
            "speech-to-speech": 2,
            "speech-to-text": 8,
            "text-to-audio": 25,
            "text-to-image": 94,
            "text-to-speech": 10,
            "text-to-video": 61,
            "training": 13,
            "video-to-video": 54,
            "vision": 23
        }
        
        # Pricing information from fal.ai/pricing
        self.pricing_info = {
            "gpu_pricing": {
                "H100": {"vram": "80GB", "price_per_hour": 1.89, "price_per_second": 0.0005},
                "H200": {"vram": "141GB", "price_per_hour": 2.10, "price_per_second": 0.0006},
                "A100": {"vram": "40GB", "price_per_hour": 0.99, "price_per_second": 0.0003},
                "B200": {"vram": "184GB", "price_per_hour": "contact_us", "price_per_second": "contact_us"}
            },
            "video_models": {
                "hunyuan-video": {"unit": "video", "price": 0.43},
                "kling-1.6-pro": {"unit": "video_second", "price": 0.095},
                "kling-2-master": {"unit": "video_second", "price": 0.28},
                "alibaba-wan": {"unit": "video", "price": 0.43},
                "minimax-video": {"unit": "video", "price": 0.52},
                "minimax/hailuo-02/standard": {"unit": "video_second", "price": 0.045},
                # ---- Added for comprehensive coverage of our catalogue ----
                # Seedance 1.0 (ByteDance)
                "bytedance/seedance/v1/pro": {"unit": "video_second", "price": 0.19},
                "bytedance/seedance/v1/lite": {"unit": "video_second", "price": 0.07},

                # Hailuo 02 Pro (MiniMax)
                "minimax/hailuo-02/pro": {"unit": "video_second", "price": 0.08},  # ~8¢/s

                # Veo family (Google DeepMind)
                "veo3": {"unit": "video_second", "price": 0.75},
                "veo3/fast": {"unit": "video_second", "price": 0.40},
                "veo2": {"unit": "video_second", "price": 0.50},

                # Kling 2.x (Kuaishou)
                "kling-video/v2.1/master": {"unit": "video_second", "price": 0.28},
                "kling-video/v2.1/pro": {"unit": "video_second", "price": 0.09},
                "kling-video/v2/master": {"unit": "video_second", "price": 0.28},

                # Pixverse
                "pixverse/v4.5": {"unit": "video_second", "price": 0.08},

                # Hunyuan
                "hunyuan-custom": {"unit": "video_second", "price": 0.16},
                "hunyuan-avatar": {"unit": "video_second", "price": 0.28},

                # MAGI-1 (Alibaba?)
                "magi": {"unit": "video_second", "price": 0.28},

                # Fast Stable Video Diffusion variants (SVD / SVD-LCM)
                "fast-svd": {"unit": "video_second", "price": 0.015},
                "fast-svd-lcm": {"unit": "video_second", "price": 0.015},

                # WAN 2.1 (Alibaba)
                "wan-i2v": {"unit": "video_second", "price": 0.04},
                "wan-t2v": {"unit": "video_second", "price": 0.04},

                # MiniMax Video-01
                "minimax/video-01": {"unit": "video_second", "price": 0.12},

                # LTX family
                "ltx-video": {"unit": "video_second", "price": 0.02},
                "ltx-video-v095": {"unit": "video_second", "price": 0.02},
                "ltx-video-13b-dev": {"unit": "video_second", "price": 0.20}
            },
            "image_models": {
                "flux-1-dev": {"unit": "megapixel", "price": 0.025},
                "flux-1-schnell": {"unit": "megapixel", "price": 0.003}, 
                "flux-1-pro": {"unit": "megapixel", "price": 0.05},
                "stable-diffusion-3-medium": {"unit": "image", "price": 0.035}
            }
        }

    def get_models_by_category(self, category: str) -> Dict[str, Any]:
        """
        Get list of models for a particular category.
        
        Args:
            category: Category name (e.g., 'text-to-image', 'image-to-video', etc.)
            
        Returns:
            Dictionary containing category info and models list
        """
        
        if category.lower() not in [cat.lower() for cat in self.categories.keys()]:
            available_categories = list(self.categories.keys())
            return {
                "error": f"Category '{category}' not found",
                "available_categories": available_categories
            }
        
        # In a real implementation, you would scrape or use an API to get the actual models
        # For now, this returns the structure based on what we discovered
        return {
            "category": category,
            "model_count": self.categories.get(category.lower(), 0),
            "description": f"Models in the {category} category",
            "note": "To get actual model list, you would need to scrape fal.ai/models with category filter",
            "example_models": self._get_example_models_for_category(category)
        }
    
    def _get_example_models_for_category(self, category: str) -> List[str]:
        """Get example models for each category based on our research"""
        examples = {
            "image-to-video": [
                "fal-ai/minimax/hailuo-02/standard/image-to-video",
                "fal-ai/kling-video/v2.1/master/image-to-video"
            ],
            "text-to-image": [
                "fal-ai/flux-pro",
                "fal-ai/imagen4/preview",
                "fal-ai/recraft-v3"
            ],
            "text-to-video": [
                "fal-ai/hunyuan-video", 
                "fal-ai/wan/v2.1"
            ]
        }
        return examples.get(category.lower(), [])

    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        Get full information about a model including OpenAPI spec, pricing, and description.
        
        Args:
            model_name: Full model name (e.g., 'fal-ai/minimax/hailuo-02/standard/image-to-video')
            
        Returns:
            Dictionary with complete model information
        """
        
        try:
            # Get OpenAPI specification
            openapi_url = f"{self.openapi_base}?endpoint_id={model_name}"
            openapi_response = requests.get(openapi_url)
            openapi_spec = openapi_response.json() if openapi_response.status_code == 200 else None
            
            # Extract model information from OpenAPI spec
            model_info = {
                "model_name": model_name,
                "openapi_spec": openapi_spec,
                "api_endpoint": f"{self.api_base_url}/{model_name}",
                "playground_url": f"{self.base_url}/models/{model_name}",
                "documentation_url": f"{self.base_url}/models/{model_name}/api"
            }
            
            if openapi_spec:
                # Extract metadata
                metadata = openapi_spec.get("info", {}).get("x-fal-metadata", {})
                model_info.update({
                    "category": metadata.get("category", "unknown"),
                    "thumbnail_url": metadata.get("thumbnailUrl"),
                    "description": openapi_spec.get("info", {}).get("description", "")
                })
                
                # Extract input/output schemas
                components = openapi_spec.get("components", {}).get("schemas", {})
                for key, schema in components.items():
                    if "Input" in key:
                        model_info["input_schema"] = schema
                    elif "Output" in key:
                        model_info["output_schema"] = schema
            
            # Add pricing information
            model_info["pricing"] = self._get_model_pricing(model_name)
            
            # Add modalities information  
            model_info["modalities"] = self._extract_modalities(model_name, openapi_spec)
            
            return model_info
            
        except Exception as e:
            return {
                "error": f"Failed to get model info: {str(e)}",
                "model_name": model_name
            }

    def _get_model_pricing(self, model_name: str) -> Dict[str, Any]:
        """Extract pricing information for a specific model"""
        
        pricing = {"type": "unknown", "details": "Pricing information not available"}
        
        # Check known video models
        for key, info in self.pricing_info["video_models"].items():
            if key in model_name.lower():
                pricing = {
                    "type": "output_based", 
                    "unit": info["unit"],
                    "price": info["price"],
                    "currency": "USD"
                }
                break
        
        # Check known image models  
        for key, info in self.pricing_info["image_models"].items():
            if key in model_name.lower():
                pricing = {
                    "type": "output_based",
                    "unit": info["unit"], 
                    "price": info["price"],
                    "currency": "USD"
                }
                break
                
        # Add specific pricing we discovered
        if "minimax/hailuo-02/standard" in model_name:
            pricing = {
                "type": "output_based",
                "unit": "video_second",
                "price": 0.045,
                "currency": "USD",
                "example": "6 second video costs $0.27"
            }
        elif "flux-pro" in model_name:
            pricing = {
                "type": "output_based",
                "unit": "megapixel", 
                "price": 0.05,
                "currency": "USD",
                "note": "Images billed by rounding up to nearest megapixel"
            }
            
        return pricing

    def _extract_modalities(self, model_name: str, openapi_spec: Optional[Dict]) -> Dict[str, List[str]]:
        """Extract input and output modalities for a model"""
        
        modalities = {
            "input": [],
            "output": [],
            "category": "unknown"
        }
        
        if openapi_spec:
            # Get category from metadata
            category = openapi_spec.get("info", {}).get("x-fal-metadata", {}).get("category", "")
            modalities["category"] = category
            
            # Parse category to determine modalities
            if "-to-" in category:
                input_mod, output_mod = category.split("-to-")
                modalities["input"] = [input_mod]
                modalities["output"] = [output_mod]
            
            # Extract from input schema if available
            components = openapi_spec.get("components", {}).get("schemas", {})
            for key, schema in components.items():
                if "Input" in key and "properties" in schema:
                    props = schema["properties"]
                    if "image_url" in props or "image" in props:
                        if "image" not in modalities["input"]:
                            modalities["input"].append("image")
                    if "prompt" in props:
                        if "text" not in modalities["input"]:
                            modalities["input"].append("text")
                
                elif "Output" in key and "properties" in schema:
                    props = schema["properties"] 
                    if "video" in props:
                        if "video" not in modalities["output"]:
                            modalities["output"].append("video")
                    if "images" in props:
                        if "image" not in modalities["output"]:
                            modalities["output"].append("image")
        
        return modalities

    def get_model_modalities(self, model_name: str) -> Dict[str, Any]:
        """
        Get all modalities that a model supports.
        
        Args:
            model_name: Full model name
            
        Returns:
            Dictionary with modality information
        """
        
        model_info = self.get_model_info(model_name)
        
        if "error" in model_info:
            return model_info
            
        return {
            "model_name": model_name,
            "modalities": model_info.get("modalities", {}),
            "category": model_info.get("category", "unknown"),
            "supported_formats": self._get_supported_formats(model_info)
        }
    
    def _get_supported_formats(self, model_info: Dict) -> Dict[str, List[str]]:
        """Extract supported file formats from model schema"""
        
        formats = {"input": [], "output": []}
        
        input_schema = model_info.get("input_schema", {})
        if "properties" in input_schema:
            # Look for file format information
            for prop_name, prop_info in input_schema["properties"].items():
                if "image" in prop_name.lower():
                    # Default image formats for image inputs
                    formats["input"].extend(["jpg", "jpeg", "png", "webp", "gif", "avif"])
                    break
        
        output_schema = model_info.get("output_schema", {})  
        if "properties" in output_schema:
            for prop_name, prop_info in output_schema["properties"].items():
                if "video" in prop_name.lower():
                    formats["output"].append("mp4")
                elif "image" in prop_name.lower():
                    formats["output"].extend(["jpeg", "png"])
        
        return formats

    def search_models(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for models by name or description.
        
        Args:
            query: Search term
            
        Returns:
            List of matching models
        """
        
        # This would require scraping the actual model list
        # For now, return a placeholder with structure
        
        return [
            {
                "model_name": "fal-ai/example-model",
                "category": "text-to-image", 
                "description": f"Example model matching '{query}'",
                "note": "Implement actual search by scraping fal.ai/models"
            }
        ]

# Example usage functions
def main():
    """Example usage of the FalAI helper"""
    
    helper = FalAIHelper()
    
    # 1. Get models by category
    print("=== Getting Image-to-Video Models ===")
    video_models = helper.get_models_by_category("image-to-video")
    print(json.dumps(video_models, indent=2))
    
    # 2. Get detailed model information
    print("\n=== Getting Model Details ===")
    model_info = helper.get_model_info("fal-ai/minimax/hailuo-02/standard/image-to-video")
    print(f"Model: {model_info['model_name']}")
    print(f"Category: {model_info.get('category', 'unknown')}")
    print(f"Pricing: {model_info.get('pricing', {})}")
    print(f"Input Schema Keys: {list(model_info.get('input_schema', {}).get('properties', {}).keys())}")
    
    # 3. Get model modalities
    print("\n=== Getting Model Modalities ===")
    modalities = helper.get_model_modalities("fal-ai/flux-pro")
    print(json.dumps(modalities, indent=2))

if __name__ == "__main__":
    main()
