'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface DemoItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  title?: string;
  category?: string;
  tags?: string[];
}

interface DemoGridProps {
  items?: DemoItem[];
  columns?: number;
  onItemClick?: (item: DemoItem) => void;
  className?: string;
  filters?: string[];
}

export function DemoGrid({ 
  items = [], 
  columns = 4,
  onItemClick,
  className = '',
  filters = []
}: DemoGridProps) {
  const [visibleItems, setVisibleItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter items based on active filters
  const filteredItems = items.filter(item => {
    if (filters.length === 0) return true;
    return item.tags?.some(tag => filters.includes(tag)) || 
           filters.includes(item.category || '');
  });

  // Initialize visible items
  useEffect(() => {
    setVisibleItems(filteredItems.slice(0, 12)); // Load first 12 items
  }, [filteredItems]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && visibleItems.length < filteredItems.length) {
          setLoading(true);
          // Simulate loading delay
          setTimeout(() => {
            const nextItems = filteredItems.slice(visibleItems.length, visibleItems.length + 8);
            setVisibleItems(prev => [...prev, ...nextItems]);
            setLoading(false);
          }, 500);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibleItems.length, filteredItems.length, loading]);

  // Generate placeholder items if no items provided
  const placeholderItems: DemoItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `placeholder-${i}`,
    type: Math.random() > 0.5 ? 'image' : 'video',
    url: '',
    thumbnail: '',
    title: `Demo Item ${i + 1}`,
    category: ['FISHEYE', 'VINTAGE', 'CYBERPUNK', 'PORTRAIT'][Math.floor(Math.random() * 4)],
    tags: ['demo', 'placeholder']
  }));

  const displayItems = visibleItems.length > 0 ? visibleItems : placeholderItems;

  return (
    <div className={`w-full ${className}`}>
      {/* Masonry Grid */}
      <div 
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {displayItems.map((item, index) => (
          <motion.div
            key={item.id}
            className="group cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={() => onItemClick?.(item)}
          >
            <div className="relative overflow-hidden rounded-lg bg-photoai-dark-lighter aspect-square">
              {/* Placeholder Content */}
              {item.url ? (
                <div className="w-full h-full bg-gradient-to-br from-photoai-accent-cyan/20 to-photoai-accent-purple/20">
                  {/* Actual image/video would go here */}
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-photoai-accent-cyan/10 to-photoai-accent-purple/10 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 mx-auto bg-white/10 rounded-lg flex items-center justify-center">
                      {item.type === 'video' ? (
                        <div className="w-0 h-0 border-l-4 border-l-white border-t-2 border-t-transparent border-b-2 border-b-transparent ml-0.5" />
                      ) : (
                        <div className="w-6 h-6 bg-white/50 rounded"></div>
                      )}
                    </div>
                    <p className="text-white/60 text-xs">{item.title}</p>
                  </div>
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="text-center space-y-2">
                  {item.type === 'video' && (
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <div className="w-0 h-0 border-l-6 border-l-white border-t-3 border-t-transparent border-b-3 border-b-transparent ml-1" />
                    </div>
                  )}
                  <div className="text-white text-sm font-medium">
                    {item.type === 'video' ? 'Play' : 'View'}
                  </div>
                </div>
              </div>

              {/* Category Badge */}
              {item.category && (
                <div className="absolute top-2 left-2">
                  <div className="neon-label text-xs">
                    {item.category}
                  </div>
                </div>
              )}

              {/* Type Indicator */}
              {item.type === 'video' && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-l-3 border-l-white border-t-1.5 border-t-transparent border-b-1.5 border-b-transparent ml-0.5" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
        {loading && (
          <div className="flex items-center space-x-2 text-white/60">
            <div className="w-4 h-4 border-2 border-photoai-accent-cyan border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Loading more...</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && items.length > 0 && (
        <div className="text-center py-12">
          <div className="text-white/60 text-lg mb-2">No items match your filters</div>
          <div className="text-white/40 text-sm">Try adjusting your filter selection</div>
        </div>
      )}
    </div>
  );
} 