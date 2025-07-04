import Image from 'next/image'
import React from 'react'
import { DemoItem } from './demo-items'

interface DemoItemCardProps {
  item: DemoItem
  onClick?: (item: DemoItem) => void
}

export function DemoItemCard({ item, onClick }: DemoItemCardProps) {
  return (
    <div
      className="relative w-full mb-4 break-inside-avoid cursor-pointer group focus:outline-none focus:ring-2 focus:ring-fine-accent-cyan rounded-lg overflow-hidden"
      tabIndex={0}
      aria-label={`${item.alt}. Click to view details`}
      role="button"
      onClick={() => onClick?.(item)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault()
          onClick(item)
        }
      }}
    >
      <Image
        src={item.src}
        alt={item.alt}
        width={400}
        height={600}
        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
        placeholder="blur"
        blurDataURL={item.src + '&blur=40&sat=-100'}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
    </div>
  )
} 