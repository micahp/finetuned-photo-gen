'use client'

import React from 'react'
import { useFormContext } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { VideoModel } from '@/lib/video-models'

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

  // Very lightweight heuristics for now. These can be replaced with a more
  // robust capability map once the param harvester JSON is integrated.
  const id = selectedModel?.id || ''
  const supportsNegativePrompt = /veo|fast-svd|ltx|pixverse/i.test(id)
  const supportsEnhancePrompt = /veo|fast-svd|ltx/i.test(id)
  const supportsEffects = /pixverse/i.test(id)
  const supportsExtend = /ltx/i.test(id)
  const supportsFirstLastFrame = /wan-flf2v/i.test(id)
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