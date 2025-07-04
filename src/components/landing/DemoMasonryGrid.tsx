import React from 'react'
import { DemoItem } from './demo-items'
import { DemoItemCard } from './DemoItemCard'

interface DemoMasonryGridProps {
  items: DemoItem[]
}

export function DemoMasonryGrid({ items }: DemoMasonryGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">No items to display.</p>
    )
  }

  return (
    <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-4 w-full">
      {items.map((item) => (
        <DemoItemCard key={item.id} item={item} />
      ))}
    </div>
  )
} 