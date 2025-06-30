import React from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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
            The First Fully Equipped&nbsp;
            <span className="bg-gradient-to-r from-photoai-accent-cyan to-photoai-accent-purple bg-clip-text text-transparent">
              AI Film Studio
            </span>
            &nbsp;for the People
          </h2>
          <p className="italic text-lg md:text-xl text-gray-300">
            Create scenes. Direct angles. Build your vision — no crew required.
          </p>
          <p className="text-gray-400 max-w-2xl mx-auto">
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
              <h3 className="text-2xl font-semibold">Generate the World</h3>
              <p className="text-gray-400">
                Pick your vibe — Tokyo at midnight, desert rave, apocalyptic freeway, 70s Hollywood.<br />
                Need a character? Build one. Yourself, someone new, or someone no one's ever seen before.
              </p>
              <p>
                <span role="img" aria-label="performer">🎭</span>{' '}
                <strong>Your film starts with a face and a feeling.</strong>
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="text-5xl font-bold text-photoai-accent-cyan md:w-32 shrink-0">2.</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">Edit the Storyboard</h3>
              <p className="text-gray-400">
                Control angles, framing, lighting, and emotion.<br />
                Shift perspectives. Try close-ups. Zoom out for the wide shot.
              </p>
              <p>
                <span role="img" aria-label="pencil">✏️</span>{' '}
                <strong>Turn stills into shots. Shots into sequences.</strong>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="text-5xl font-bold text-photoai-accent-cyan md:w-32 shrink-0">3.</div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">Bring It to Life</h3>
              <p className="text-gray-400">
                Hit <span role="img" aria-label="camera">🎥</span> Make Video. Your scenes come alive — full-motion, full-mood, AI-powered mini movies.<br />
                <em>Coming soon: voiceovers, soundtracks, motion loops, and more.</em>
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-gray-700" />

        {/* Closing copy & CTA */}
        <div className="text-center space-y-6">
          <p className="text-xl font-medium">Welcome to your AI backlot.</p>
          <p className="text-gray-300 max-w-2xl mx-auto">
            It's not just a film studio. It's <em>your</em> film studio — built for the internet, powered by you.
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