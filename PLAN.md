# PLAN: Integrate Seedance Creator as mobile app in monorepo

## Existing Codebase
- **finetuned-photo-gen**: Next.js 14 + TypeScript + Prisma + NextAuth
- Tech stack: React 19, Tailwind, Shadcn/ui, FAL.ai for image/video gen
- Already uses @fal-ai/client for FAL.ai API integration

## Previous Work (t_854b5c81)
- seedance-creator: Standalone Expo React Native app
- Features: Storyboard editor, scene management, FAL Seedance 2.0 integration, gallery
- Used AsyncStorage for persistence, custom FAL client

## Integration Strategy (Minimal Change)
1. Create feature/seedance-creator branch
2. Add mobile/ directory for React Native/Expo app
3. Copy seedance-creator structure into mobile/seedance-creator/
4. Update package.json to use monorepo structure (optional: workspaces)
5. Commit all mobile app files
6. Push to GitHub and create PR

## Files to Add (from previous workspace)
- mobile/seedance-creator/app/** (Expo Router screens)
- mobile/seedance-creator/lib/** (fal.ts, storage.ts, types.ts)
- mobile/seedance-creator/package.json, app.json, tsconfig.json
- mobile/seedance-creator/assets/**
- mobile/seedance-creator/README.md

## No Refactor Work
- Do NOT refactor existing Next.js code
- Do NOT modify root package.json unless needed
- Keep mobile app as standalone Expo project within monorepo

## Branch: feature/seedance-creator
PR Title: "feat: add Seedance Creator mobile app"
