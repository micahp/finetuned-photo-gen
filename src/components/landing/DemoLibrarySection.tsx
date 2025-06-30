'use client'

import React, { useMemo, useState } from 'react'
import { TagFilterRow, FilterTag } from './TagFilterRow'
import { DemoMasonryGrid } from './DemoMasonryGrid'
import { demoItems } from './demo-items'

interface CategoryLabel {
  id: string
  name: string
  color: string
}

const categories: CategoryLabel[] = [
  {
    id: 'creator-career',
    name: 'Creator & Career',
    color: 'from-cyan-400 to-blue-500'
  },
  {
    id: 'viral-internet',
    name: 'Viral & Internet Culture',
    color: 'from-pink-400 to-purple-500'
  },
  {
    id: 'place-based',
    name: 'Place-Based',
    color: 'from-green-400 to-emerald-500'
  },
  {
    id: 'style-theme',
    name: 'Style & Theme',
    color: 'from-yellow-400 to-orange-500'
  }
]

const sampleFilterTags: FilterTag[] = [
  { id: 'all', label: 'All', count: 1200 },
  { id: 'portrait', label: 'Portrait', count: 450 },
  { id: 'landscape', label: 'Landscape', count: 320 },
  { id: 'artistic', label: 'Artistic', count: 280 },
  { id: 'professional', label: 'Professional', count: 350 },
  { id: 'casual', label: 'Casual', count: 180 },
  { id: 'studio', label: 'Studio', count: 240 },
  { id: 'outdoor', label: 'Outdoor', count: 290 },
  { id: 'vintage', label: 'Vintage', count: 120 },
  { id: 'modern', label: 'Modern', count: 380 },
  { id: 'colorful', label: 'Colorful', count: 210 },
  { id: 'monochrome', label: 'Monochrome', count: 95 },
  { id: 'fantasy', label: 'Fantasy', count: 150 },
  { id: 'realistic', label: 'Realistic', count: 520 }
]

export function DemoLibrarySection() {
  const [selectedTags, setSelectedTags] = useState<string[]>(['all'])

  const handleTagsChange = (newSelectedTags: string[]) => {
    setSelectedTags(newSelectedTags)
    // Here you would typically update the grid content based on selected filters
    console.log('Selected filter tags:', newSelectedTags)
  }

  return (
    <section 
      className="w-full bg-black py-20 px-4 sm:px-6 lg:px-8"
      aria-labelledby="demo-library-heading"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 
            id="demo-library-heading"
            className="text-4xl md:text-5xl font-bold text-white mb-6"
          >
            Infinite Demo Library
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Explore endless possibilities with our curated collection of AI-generated content across different themes and styles.
          </p>
        </div>

        {/* Category Labels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {categories.map((category) => (
            <div
              key={category.id}
              className="group relative"
              role="button"
              tabIndex={0}
              aria-label={`View ${category.name} category`}
            >
              {/* Neon Glow Effect */}
              <div 
                className={`absolute inset-0 bg-gradient-to-r ${category.color} rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-300`}
                aria-hidden="true"
              />
              
              {/* Category Card */}
              <div className="relative bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 text-center transition-all duration-300 group-hover:border-gray-500 group-hover:bg-gray-900/90">
                <h3 
                  className={`text-xl font-bold bg-gradient-to-r ${category.color} bg-clip-text text-transparent mb-2 group-hover:scale-105 transition-transform duration-300`}
                >
                  {category.name}
                </h3>
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-500 group-hover:w-full w-3/4`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tag Filter Row */}
        <div className="mb-8">
          <TagFilterRow
            tags={sampleFilterTags}
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
            multiSelect={false}
            pillVariant="category"
            pillSize="sm"
            className="bg-gray-900/50 rounded-xl border border-gray-700 px-2"
          />
        </div>

        {/* Masonry Grid */}
        {useMemo(() => {
          const filtered = selectedTags.includes('all')
            ? demoItems
            : demoItems.filter((item) => selectedTags.includes(item.category))

          return (
            <DemoMasonryGrid items={filtered} />
          )
        }, [selectedTags])}
      </div>
    </section>
  )
} 