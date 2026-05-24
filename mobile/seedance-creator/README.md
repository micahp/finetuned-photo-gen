# Seedance Creator 🎬

**React Native (Expo) mobile app for AI anime video creation with Seedance 2.0**

Create storyboards, write scene prompts with style presets, and generate anime/cartoon video clips using ByteDance's Seedance 2.0 model via [FAL.ai](https://fal.ai).

## Features

- **Storyboard Editor** — Create, rename, and manage storyboards. Add/remove/reorder scenes per storyboard.
- **Scene Prompt Builder** — Write detailed scene descriptions with 10 style presets (Anime, Retro Anime, Cartoon, Cinematic, Pixel Art, Stop Motion, Watercolor, Xianxia/Wuxia, Cyberpunk, Sakuga).
- **Reference Images** — Attach reference images for character/scene consistency.
- **Seedance 2.0 Integration** — Direct FAL.ai API integration. Submit prompts, poll generation status, and receive video clips.
- **Gallery** — Browse all generated clips across all storyboards.
- **Cross-platform** — Works on iOS and Android via Expo.

## Architecture

```
seedance-creator/
├── app/                        # Expo Router (file-based routing)
│   ├── _layout.tsx              # Root layout with Stack navigator
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab layout (3 tabs)
│   │   ├── index.tsx            # Storyboards list screen
│   │   ├── gallery.tsx          # Generated clips gallery
│   │   └── settings.tsx         # API key config + about
│   └── scene/
│       └── [id].tsx             # Scene editor (modal)
├── lib/
│   ├── types.ts                 # Data models, presets, prompt builder
│   ├── fal.ts                   # FAL.ai API client (submit + poll)
│   └── storage.ts               # AsyncStorage persistence layer
└── package.json
```

## Seedance 2.0 Prompt Format

The app constructs prompts following the Seedance 2.0 conventions documented in [songguoxs/seedance-prompt-skill](https://github.com/songguoxs/seedance-prompt-skill):

- Style preset prefix (e.g., "anime style, vibrant colors, clean lineart...")
- User's scene description
- Reference annotations (up to 9 images, 3 videos, 3 audio)
- Max 5,000 characters per prompt
- Video output: 5, 10, or 15 seconds

## Pipeline Reference

Inspired by [MemeCalculate/moyin-creator](https://github.com/MemeCalculate/moyin-creator), a production-grade Electron app for AI film production with Seedance 2.0.

## Getting Started

### Prerequisites

- Node.js >= 18
- Expo CLI (`npm install -g expo-cli`)
- A FAL.ai account with API key ([fal.ai/dashboard](https://fal.ai/dashboard))

### Install

```bash
git clone <repo-url> seedance-creator
cd seedance-creator
npm install
```

### Run

```bash
npx expo start
```

Then scan the QR code with Expo Go (iOS/Android) or press `w` for web.

### Configure API Key

1. Open the app
2. Go to **Settings** tab
3. Paste your FAL.ai API key
4. Tap "Save & Verify"

## Usage Flow

1. **Create a storyboard** — Tap the + button on the Storyboards tab.
2. **Add scenes** — For each scene: pick a style preset, write a prompt, optionally add a reference image.
3. **Generate** — Select a scene and tap "Generate Video". The app submits to Seedance 2.0 via FAL.ai and polls until complete.
4. **View results** — Generated clips appear in the Gallery tab.

## License

MIT
