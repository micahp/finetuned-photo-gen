'use client'

import React, { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { VideoModel } from '@/lib/video-models'
import inputGroups from '@/data/fal_input_groups.json'

interface Props {
  selectedModel?: VideoModel
}

/**
 * Displays optional advanced parameters discovered in latest Fal.ai specs.
 * Renders only the fields relevant to the currently selected model.
 *
 * NOTE: This component relies on being wrapped inside an RHF <Form> provider
 * created in the parent page. All fields are registered in that parent form.
 */
const AdvancedParametersForm: React.FC<Props> = ({ selectedModel }) => {
  const { control } = useFormContext()

  // --------------------------------------------------------------
  // Capability detection driven by `fal_input_groups.json` mapping
  // produced by the harvester script. Falls back to previous
  // heuristics when mapping is missing.
  // --------------------------------------------------------------

  const capability = useMemo(() => {
    if (!selectedModel) return null
    const record = (inputGroups as Record<string, { above: string[]; advanced: string[] }>)[selectedModel.id]
    if (!record) return null
    const adv = new Set(record.advanced)
    return {
      negativePrompt: adv.has('negative_prompt'),
      enhancePrompt: adv.has('enhance_prompt'),
      effects: adv.has('effects'),
      extend: adv.has('extend'),
      firstLastFrame: adv.has('first_frame') || adv.has('last_frame'),
    }
  }, [selectedModel])

  const id = selectedModel?.id || ''
  // Fallback heuristics ensure we don't hide fields if mapping is missing.
  const supportsNegativePrompt = capability?.negativePrompt ?? /veo|fast-svd|ltx|pixverse/i.test(id)
  const supportsEnhancePrompt = capability?.enhancePrompt ?? /veo|fast-svd|ltx/i.test(id)
  const supportsEffects = capability?.effects ?? /pixverse/i.test(id)
  const supportsExtend = capability?.extend ?? /ltx/i.test(id)
  const supportsFirstLastFrame = capability?.firstLastFrame ?? /wan-flf2v/i.test(id)
  const supportsResolution = !!selectedModel?.resolutionMultipliers

  return (
    <div className="space-y-4">
      {supportsNegativePrompt && (
        <FormField
          control={control}
          name="negativePrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Negative Prompt</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="What should NOT appear in the video?"
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {supportsEnhancePrompt && (
        <FormField
          control={control}
          name="enhancePrompt"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel className="!mb-0">Enhance Prompt</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {supportsEffects && (
        <FormField
          control={control}
          name="effects"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Effects (comma-separated)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="glitch, neon"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {supportsExtend && (
        <FormField
          control={control}
          name="extend"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel className="!mb-0">Extend (generate extra frames)</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {supportsFirstLastFrame && (
        <>
          <FormField
            control={control}
            name="firstFrame"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Frame URL</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com/frame1.png" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="lastFrame"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Frame URL</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com/frameN.png" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {supportsResolution && (
        <FormField
          control={control}
          name="resolution"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resolution</FormLabel>
              <FormControl>
                <select
                  value={field.value || ''}
                  onChange={field.onChange}
                  className="w-full border rounded-md py-2 px-3 text-sm"
                >
                  <option value="">Auto (default)</option>
                  {selectedModel &&
                    Object.keys(selectedModel.resolutionMultipliers || {}).map((res) => (
                      <option key={res} value={res}>
                        {res}
                      </option>
                    ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}

export default AdvancedParametersForm 