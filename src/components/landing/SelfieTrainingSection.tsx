import Image from 'next/image'
import React from 'react'

interface SelfieTrainingSectionProps {
  /**
   * Optional override for the input selfie image URLs. Defaults to four example selfies.
   */
  inputImageUrls?: string[]
  /**
   * Optional override for the generated output image URL. Defaults to an example generated photo.
   */
  outputImageUrl?: string
  /**
   * Optional override for the arrow image URL.
   */
  arrowImageUrl?: string
  /**
   * CTA link for the output image (optional)
   */
  outputLink?: string
}

/**
 * A visually engaging section that shows the typical Photo-AI workflow:
 * 1. Upload a set of selfies (input images)
 * 2. → arrow →
 * 3. Receive an AI-generated output photo
 *
 * The component is designed responsively with TailwindCSS and uses `next/image`
 * for optimized image loading.  All image URLs are external (served via Cloudflare)
 * so they can be replaced later with the user's own LoRA images without code changes.
 */
export function SelfieTrainingSection({
  inputImageUrls = [
    'https://photoai.com/cdn-cgi/image/format=auto,fit=cover,height=500,width=500,quality=50/assets/training_examples/good/h.jpeg?1716128114',
    'https://photoai.com/cdn-cgi/image/format=auto,fit=cover,height=500,width=500,quality=50/assets/training_examples/good/g.jpeg?1708109686',
    'https://photoai.com/cdn-cgi/image/format=auto,fit=cover,height=500,width=500,quality=50/assets/training_examples/good/f.jpeg?1708109686',
    'https://photoai.com/cdn-cgi/image/format=auto,fit=cover,height=500,width=500,quality=50/assets/training_examples/good/e.jpeg?1708109686'
  ],
  outputImageUrl =
    'https://photoai.com/cdn-cgi/image/format=jpeg,width=1000,quality=50/https://r2-us-west.photoai.com/1723596600-599fad91c8823eedc9646f3b6dec2c4e-1.png?1723596599',
  arrowImageUrl =
    'https://photoai.com/cdn-cgi/image/format=auto,fit=cover,height=400,quality=75/assets/pencil-arrow.png?25',
  outputLink = 'https://x.com/levelsio'
}: SelfieTrainingSectionProps) {
  return (
    <section
      id="selfies"
      className="w-full bg-white py-20 px-4 sm:px-6 lg:px-8"
      aria-labelledby="selfies-heading"
    >
      <div className="max-w-7xl mx-auto text-center">
        <h2
          id="selfies-heading"
          className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-12"
        >
          Upload your selfies and start taking stunning AI photos now
        </h2>

        {/* Example workflow visualization */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Input selfies */}
          <div className="grid grid-cols-3 gap-4 md:grid-cols-2 md:gap-6 max-w-md">
            {inputImageUrls.slice(0, 6).map((url, i) => (
              <Image
                key={url}
                src={url}
                alt={`Training input selfie ${i + 1}`}
                width={140}
                height={140}
                className="rounded-lg object-cover shadow-lg w-24 h-24 md:w-36 md:h-36 border border-gray-200"
              />
            ))}
          </div>

          {/* Arrow */}
          <Image
            src={arrowImageUrl}
            alt="Arrow indicating AI training"
            width={160}
            height={160}
            className="hidden md:block rotate-0 md:rotate-12"
          />

          {/* Output image */}
          <div className="relative">
            {/* Badge */}
            <span className="absolute top-2 right-2 bg-brand-blue text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">
              PhotoGen AI Result
            </span>
            {outputLink ? (
              <a href={outputLink} target="_blank" rel="noopener noreferrer">
                <Image
                  src={outputImageUrl}
                  alt="AI generated output sample"
                  width={300}
                  height={450}
                  className="rounded-xl object-cover shadow-2xl border border-gray-200"
                />
              </a>
            ) : (
              <Image
                src={outputImageUrl}
                alt="AI generated output sample"
                width={300}
                height={450}
                className="rounded-xl object-cover shadow-2xl border border-gray-200"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
} 