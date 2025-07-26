#!/usr/bin/env tsx
/**
 * Script: generate-fal-video-report.ts
 * -----------------------------------
 * Phase-1 helper that scans the OpenAPI specs downloaded into `scripts/fal_api_specs/`,
 * extracts the key generation constraints for each endpoint and compares them with
 * the hard-coded configuration in `src/lib/video-models.ts`.
 *
 * Usage:
 *   pnpm tsx scripts/generate-fal-video-report.ts
 *   # or
 *   npx tsx scripts/generate-fal-video-report.ts
 *
 * The script writes a human-readable Markdown report to `docs/fal_video_model_diff.md`
 * and also prints it to stdout so CI can display it directly.
 */

import fs from 'fs'
import path from 'path'
import { FalEndpointSpec } from '../src/lib/fal-endpoint-spec'
import { VIDEO_MODELS } from '../src/lib/video-models'

/* -------------------------------------------------------------------------- */
/*                               Helper Utils                                 */
/* -------------------------------------------------------------------------- */

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

/** Extracts relevant enums + extra params from an OpenAPI spec */
function extractFalEndpointSpec(filePath: string): FalEndpointSpec | null {
  type OpenApi = any // we only access a handful of properties, so keep loose on types
  const data: OpenApi = readJsonFile<OpenApi>(filePath)

  const meta = data?.info?.['x-fal-metadata'] as
    | { endpointId: string; category: string }
    | undefined
  if (!meta) return null

  const { endpointId, category } = meta

  let aspectRatioEnum: string[] | undefined
  let durationEnum: string[] | undefined
  const extraParams: string[] = []

  const SCHEMA_CONTAINER = data?.components?.schemas ?? {}

  for (const schema of Object.values<any>(SCHEMA_CONTAINER)) {
    if (!schema?.properties) continue
    const props = schema.properties as Record<string, any>

    // Aspect ratio / duration enums (if present)
    if (props.aspect_ratio?.enum && Array.isArray(props.aspect_ratio.enum)) {
      aspectRatioEnum = props.aspect_ratio.enum as string[]
    }
    if (props.duration?.enum && Array.isArray(props.duration.enum)) {
      durationEnum = props.duration.enum as string[]
    }

    // Detect extra params we care about
    for (const p of ['negative_prompt', 'enhance_prompt', 'effects', 'extend']) {
      if (props[p] && !extraParams.includes(p)) {
        extraParams.push(p)
      }
    }
  }

  return {
    endpointId,
    category,
    aspectRatioEnum,
    durationEnum,
    extraParams,
  }
}

/** String difference helper – returns true if arrays differ (ignoring order). */
function arraysDiffer(a: readonly string[] | undefined, b: readonly string[] | undefined) {
  const _a = a ? [...a].sort() : []
  const _b = b ? [...b].sort() : []
  return JSON.stringify(_a) !== JSON.stringify(_b)
}

/* -------------------------------------------------------------------------- */
/*                              Main Processing                               */
/* -------------------------------------------------------------------------- */

const SPECS_DIR = path.join(__dirname, 'fal_api_specs')
if (!fs.existsSync(SPECS_DIR)) {
  console.error('❌ fal_api_specs directory not found – did you run fetch_fal_api_specs.py?')
  process.exit(1)
}

const specFiles = fs
  .readdirSync(SPECS_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(SPECS_DIR, f))

const specs: FalEndpointSpec[] = []
for (const file of specFiles) {
  try {
    const spec = extractFalEndpointSpec(file)
    if (spec) specs.push(spec)
  } catch (err) {
    console.warn('⚠️  Failed to parse', file, err)
  }
}

// Map VIDEO_MODELS by falModelId for quick lookup
const modelsByEndpoint = new Map<string, typeof VIDEO_MODELS[number]>()
VIDEO_MODELS.forEach(m => modelsByEndpoint.set(m.falModelId, m))

/* ------------------------------- Diff Checks ------------------------------- */
const missingEndpoints: FalEndpointSpec[] = []
interface ParamMismatch {
  endpointId: string
  modelId: string
  aspectRatioDiff?: { code: string[]; spec: string[] }
  durationDiff?: { code: string[]; spec: string[] }
}
const mismatches: ParamMismatch[] = []

for (const spec of specs) {
  const model = modelsByEndpoint.get(spec.endpointId)
  if (!model) {
    missingEndpoints.push(spec)
    continue
  }

  // compare enums
  if (arraysDiffer(spec.aspectRatioEnum, model.supportedAspectRatios)) {
    mismatches.push({
      endpointId: spec.endpointId,
      modelId: model.id,
      aspectRatioDiff: {
        code: model.supportedAspectRatios,
        spec: spec.aspectRatioEnum ?? [],
      },
    })
  }
  const modelDurationStrings = (model.durationOptions ?? []).map(v => `${v}s`)
  if (arraysDiffer(spec.durationEnum, modelDurationStrings)) {
    // Check if we already pushed for aspect ratio diff
    const existing = mismatches.find(m => m.endpointId === spec.endpointId)
    if (existing) {
      existing.durationDiff = {
        code: modelDurationStrings,
        spec: spec.durationEnum ?? [],
      }
    } else {
      mismatches.push({
        endpointId: spec.endpointId,
        modelId: model.id,
        durationDiff: {
          code: modelDurationStrings,
          spec: spec.durationEnum ?? [],
        },
      })
    }
  }
}

/* ------------------------------- Report Gen ------------------------------- */
let report = '# Fal Video Model Diff Report\n\n'
report += `*Generated: ${new Date().toISOString()}*\n\n`

report += '## 1. Missing Endpoints in `VIDEO_MODELS`\n\n'
if (missingEndpoints.length === 0) {
  report += '✅ No missing endpoints – library is up-to-date.\n\n'
} else {
  for (const ep of missingEndpoints) {
    report += `- **${ep.endpointId}** (${ep.category})\n`
  }
  report += '\n'
}

report += '## 2. Parameter Mismatches\n\n'
if (mismatches.length === 0) {
  report += '✅ All aspect-ratio and duration enums match the specs.\n'
} else {
  for (const mm of mismatches) {
    report += `### ${mm.endpointId}\n`
    if (mm.aspectRatioDiff) {
      report += `- Aspect ratios (code): ${mm.aspectRatioDiff.code.join(', ')}\n`
      report += `- Aspect ratios (spec): ${mm.aspectRatioDiff.spec.join(', ')}\n`
    }
    if (mm.durationDiff) {
      report += `- Durations (code): ${mm.durationDiff.code.join(', ')}\n`
      report += `- Durations (spec): ${mm.durationDiff.spec.join(', ')}\n`
    }
    report += '\n'
  }
}

/* ----------------------------- Write + Output ----------------------------- */
const OUTPUT_PATH = path.join('docs', 'fal_video_model_diff.md')
fs.writeFileSync(OUTPUT_PATH, report)
console.log(report)
console.log(`\n📄 Diff report saved to ${OUTPUT_PATH}`) 