'use client'

import React from 'react'
import { DemoMasonryGrid } from './DemoMasonryGrid'
import { demoItems } from './demo-items'

export function DemoLibrarySection() {
  return (
    <section 
      className="w-full py-16 px-4 sm:px-6 lg:px-8"
      aria-labelledby="demo-library-heading"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 
            id="demo-library-heading"
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
          >
            Infinite Demo Library
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore endless possibilities with our curated collection of AI-generated content across different themes and styles.
          </p>
        </div>

        {/* Masonry Grid */}
        <DemoMasonryGrid items={demoItems} />
      </div>
    </section>
  )
} 