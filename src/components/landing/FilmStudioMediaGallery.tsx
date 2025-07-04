import React from 'react'
import Image from 'next/image'

import sourceImg from '@/assets/images/source image.png'
import storyboard1 from '@/assets/images/forest waterfall.png'
import storyboard2 from '@/assets/images/deer.png'
import storyboard3 from '@/assets/images/boots.png'
import storyboard4 from '@/assets/images/men on horses.png'

// Serve video from public/videos to avoid bundler issues. Ensure the file is placed there.
const videoClipSrc = '/videos/archer-in-the-woods.mp4'

export function FilmStudioMediaGallery() {
  return (
    <div className="grid gap-6 md:grid-cols-3 mt-12">
      {/* Step 1 Image */}
      <div className="flex flex-col items-center text-center space-y-2">
        <Image
          src={sourceImg}
          alt="Sample source image"
          className="rounded-lg shadow-lg"
          placeholder="blur"
        />
        <span className="text-sm text-gray-400">Source Image</span>
      </div>

      {/* Step 2 Storyboard Images */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Image
            src={storyboard1}
            alt="Storyboard frame 1"
            className="rounded-lg shadow-md"
            placeholder="blur"
          />
          <Image
            src={storyboard2}
            alt="Storyboard frame 2"
            className="rounded-lg shadow-md"
            placeholder="blur"
          />
          <Image
            src={storyboard3}
            alt="Storyboard frame 3"
            className="rounded-lg shadow-md"
            placeholder="blur"
          />
          <Image
            src={storyboard4}
            alt="Storyboard frame 4"
            className="rounded-lg shadow-md"
            placeholder="blur"
          />
        </div>
        <span className="text-sm text-gray-400">Storyboard Panels</span>
      </div>

      {/* Step 3 Video */}
      <div className="flex flex-col items-center text-center space-y-2">
        <video
          src={videoClipSrc}
          className="rounded-lg shadow-lg w-full h-auto"
          controls
          muted
          loop
        />
        <span className="text-sm text-gray-400">Animated Clip</span>
      </div>
    </div>
  )
} 