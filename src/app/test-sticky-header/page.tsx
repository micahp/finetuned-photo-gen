'use client';

import { StickyHeader } from '@/components/landing/StickyHeader';

export default function TestStickyHeaderPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <StickyHeader />
      
      {/* Simple content to test scrolling */}
      <div className="pt-16">
        <section className="h-screen flex items-center justify-center bg-blue-500">
          <h1 className="text-white text-4xl">Section 1 - Blue</h1>
        </section>
        
        <section className="h-screen flex items-center justify-center bg-green-500">
          <h1 className="text-white text-4xl">Section 2 - Green</h1>
        </section>
        
        <section className="h-screen flex items-center justify-center bg-red-500">
          <h1 className="text-white text-4xl">Section 3 - Red</h1>
        </section>
      </div>
    </div>
  );
} 