// ─── Core data types for Seedance Creator ───

export type SceneStatus = "idle" | "generating" | "done" | "failed";

export interface Scene {
  id: string;
  prompt: string;
  referenceImageUri?: string;
  referenceVideoUri?: string;
  stylePreset: StylePresetKey;
  status: SceneStatus;
  generatedVideoUri?: string;
  falRequestId?: string;
  errorMessage?: string;
  createdAt: number;
}

export interface Storyboard {
  id: string;
  title: string;
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
}

// ─── Style / character presets ───

export const STYLE_PRESETS = {
  anime: {
    label: "Anime",
    prefix: "anime style, vibrant colors, clean lineart, Japanese animation, ",
  },
  retroAnime: {
    label: "Retro Anime (80s/90s)",
    prefix: "retro 90s anime style, cel animation, grainy film texture, hand-drawn, ",
  },
  cartoon: {
    label: "Cartoon",
    prefix: "cartoon style, bold outlines, flat colors, exaggerated expressions, ",
  },
  cinematic: {
    label: "Cinematic",
    prefix: "cinematic lighting, photorealistic, film grain, 24fps, anamorphic lens, ",
  },
  pixelArt: {
    label: "Pixel Art",
    prefix: "pixel art style, 16-bit, game sprite, dithering, limited palette, ",
  },
  stopMotion: {
    label: "Stop Motion",
    prefix: "stop motion style, claymation, tactile texture, slight frame jitter, ",
  },
  watercolor: {
    label: "Watercolor",
    prefix: "watercolor painting style, soft washes, bleeding edges, artistic, ",
  },
  xianxia: {
    label: "Xianxia / Wuxia",
    prefix: "Chinese fantasy martial arts style, flowing robes, qi energy effects, cinematic, ",
  },
  cyberpunk: {
    label: "Cyberpunk",
    prefix: "cyberpunk style, neon lights, rain-slicked streets, high tech low life, blade runner aesthetic, ",
  },
  sakuga: {
    label: "Sakuga (Fluid Action)",
    prefix: "sakuga animation, fluid motion, dynamic action, smear frames, impact frames, ",
  },
} as const;

export type StylePresetKey = keyof typeof STYLE_PRESETS;

// ─── Seedance 2.0 constraints ───

export const SEEDANCE_LIMITS = {
  maxImages: 9,
  maxVideos: 3,
  maxAudio: 3,
  maxPromptChars: 5000,
};

// ─── Seedance 2.0 prompt construction helpers ───

export function buildSeedancePrompt(
  textPrompt: string,
  stylePreset: StylePresetKey,
  hasReferenceImage: boolean,
  hasReferenceVideo: boolean = false,
): string {
  const preset = STYLE_PRESETS[stylePreset];
  let prompt = preset.prefix + textPrompt;

  // Add reference placeholders (actual URIs are uploaded to FAL first)
  if (hasReferenceImage) {
    prompt += " Use the provided image as reference for character/scene consistency.";
  }
  if (hasReferenceVideo) {
    prompt += " Match the camera motion and pacing from the reference video.";
  }

  if (prompt.length > SEEDANCE_LIMITS.maxPromptChars) {
    prompt = prompt.substring(0, SEEDANCE_LIMITS.maxPromptChars - 3) + "...";
  }
  return prompt;
}

// ─── Camera language shortcuts ───

export const CAMERA_PRESETS = {
  closeUp: "Close-up shot, shallow depth of field, intimate framing",
  medium: "Medium shot, natural framing, character waist-up",
  wide: "Wide establishing shot, deep depth of field, environmental context",
  lowAngle: "Low angle shot, heroic perspective, imposing presence",
  highAngle: "High angle overhead shot, vulnerable perspective, dramatic",
  tracking: "Smooth tracking shot, steady camera movement following subject",
  handheld: "Handheld shaky cam, documentary style, raw realism",
  dutch: "Dutch angle, tilted frame, unease and disorientation",
  slowMotion: "Slow motion, 60fps played at 24fps, dramatic emphasis",
  timeLapse: "Time lapse, accelerated motion, clouds and light changing rapidly",
  drone: "Drone aerial shot, sweeping panoramic motion, birds-eye view",
  dollyZoom: "Dolly zoom / vertigo effect, background compresses while foreground stays",
  whipPan: "Whip pan, fast horizontal blur, energetic transition",
  rackFocus: "Rack focus, shift from foreground to background, reveal detail",
} as const;
