import React from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FilmStudioMediaGallery } from './FilmStudioMediaGallery'

export function FilmStudioSection() {
  return (
    <section
      id="film-studio"
      className="w-full bg-gray-900 text-white py-20 px-4 sm:px-6 lg:px-8"
      aria-labelledby="film-studio-heading"
    >
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Heading */}
        <div className="text-center space-y-4">
          <h2
            id="film-studio-heading"
            className="text-3xl md:text-5xl font-extrabold tracking-tight"
          >
            <span role="img" aria-label="clapper" className="mr-2">🎬</span>
            Your Personalized AI Film Studio
          </h2>
          <p className="italic text-lg md:text-xl text-gray-300">
          You don't need a camera. Or a cast. Or a $10k budget.<br />
          All you need is an idea.
          </p>
        </div>

        {/* How it works */}
        <div className="space-y-10">
          {/* Step 1 */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="text-5xl font-bold text-photoai-accent-cyan md:w-32 shrink-0">1.</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">Generate a Source Image</h3>
              <p className="text-gray-400">
                Your very first frame sets the tone. Create a single reference image with <em>Generate</em> that defines style, environment, and the main character(s).
              </p>
              <p>
                <span role="img" aria-label="sparkles">✨</span>{' '}
                <strong>One picture, endless possibilities.</strong>
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="text-5xl font-bold text-photoai-accent-cyan md:w-32 shrink-0">2.</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">Create the Storyboard</h3>
              <p className="text-gray-400">
                Spin up as many scenes as you like from your source image using <em>Edit</em> (powered by Flux&nbsp;Kontext).<br />
                Vary angles, moods, and settings to map out your narrative.
              </p>
              <p>
                <span role="img" aria-label="pencil">✏️</span>{' '}
                <strong>Scenes become panels. Panels become your storyboard.</strong>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="text-5xl font-bold text-photoai-accent-cyan md:w-32 shrink-0">3.</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">Animate &amp; Stitch</h3>
              <p className="text-gray-400">
                Turn each storyboard panel into motion with our image-to-video engine on the <em>Video</em> tab, then automatically stitch the clips together.<br />
                <em>Your short film is ready for prime time.</em>
              </p>
            </div>
          </div>
        </div>

        {/* Media Gallery */}
        <FilmStudioMediaGallery />

        {/* Divider */}
        <hr className="border-gray-700" />

        {/* Closing copy & CTA */}
        <div className="text-center space-y-6">
          <p className="text-xl font-medium">Cast yourself in <em>any</em> movie.</p>
          <p className="text-gray-300 max-w-2xl mx-auto">
            <em>You're</em> the main character. The only limit is your imagination.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-photoai-accent-cyan hover:bg-photoai-accent-cyan/90 text-black font-semibold px-8 py-4"
          >
            <Link href="/register">
              <span role="img" aria-label="film">🎞️</span> Start your first scene &rarr;
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
} 