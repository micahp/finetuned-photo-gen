# Mobile Apps

This directory contains mobile apps built for the finetuned-photo-gen ecosystem.

## Apps

### Seedance Creator

A React Native/Expo app for creating AI-generated anime video clips using ByteDance's Seedance 2.0 model via FAL.ai.

**See:** [seedance-creator/README.md](seedance-creator/README.md)

**Features:**
- Storyboard editor (add/remove/reorder scenes)
- Per-scene prompt input with 10 style presets (anime, cartoon, cinematic, etc.)
- Reference image support for character consistency
- FAL.ai Seedance 2.0 API integration
- Gallery of generated clips

**Setup:**
```bash
cd mobile/seedance-creator
npm install
npx expo start
```
