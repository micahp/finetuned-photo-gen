'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { X, Download, Shuffle, ArrowUp, Video, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  title?: string;
  category?: string;
  creditCost?: {
    recreate: number;
    remix: number;
    upscale: number;
    makeVideo: number;
  };
}

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MediaItem | null;
  items?: MediaItem[];
  onNavigate?: (direction: 'prev' | 'next') => void;
  onAction?: (action: string, item: MediaItem) => void;
}

export function MediaModal({ 
  isOpen, 
  onClose, 
  item, 
  items = [],
  onNavigate,
  onAction 
}: MediaModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Find current item index
  useEffect(() => {
    if (item && items.length > 0) {
      const index = items.findIndex(i => i.id === item.id);
      if (index !== -1) setCurrentIndex(index);
    }
  }, [item, items]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (items.length > 1) {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          setCurrentIndex(prevIndex);
          onNavigate?.('prev');
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (items.length > 1) {
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          setCurrentIndex(nextIndex);
          onNavigate?.('next');
        }
        break;
    }
  }, [isOpen, onClose, onNavigate, currentIndex, items.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!item) return null;

  const defaultCreditCost = {
    recreate: 5,
    remix: 3,
    upscale: 2,
    makeVideo: 10
  };

  const creditCost = item.creditCost || defaultCreditCost;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-7xl h-full max-h-[90vh] dark-glass rounded-xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Navigation Arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                    setCurrentIndex(prevIndex);
                    onNavigate?.('prev');
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={() => {
                    const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                    setCurrentIndex(nextIndex);
                    onNavigate?.('next');
                  }}
                  className="absolute right-20 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            <div className="flex h-full">
              {/* Media Area (2/3) */}
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="relative w-full h-full max-w-4xl">
                  {item.type === 'video' ? (
                    <div className="w-full h-full bg-gradient-to-br from-fine-accent-cyan/20 to-fine-accent-purple/20 rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-l-12 border-l-white border-t-8 border-t-transparent border-b-8 border-b-transparent ml-2" />
                        </div>
                        <p className="text-white text-lg">Video: {item.title}</p>
                        <div className="neon-label">Video Player Placeholder</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-fine-accent-cyan/20 to-fine-accent-purple/20 rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <div className="w-24 h-24 mx-auto bg-white/10 rounded-lg flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/50 rounded"></div>
                        </div>
                        <p className="text-white text-lg">Image: {item.title}</p>
                        <div className="neon-label">Image Viewer Placeholder</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Rail (1/3) */}
              <div className="w-80 bg-black/30 border-l border-white/10 p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Item Info */}
                  <div>
                    <h3 className="text-white text-xl font-semibold mb-2">
                      {item.title || 'Untitled'}
                    </h3>
                    {item.category && (
                      <div className="neon-label mb-4">{item.category}</div>
                    )}
                    <div className="text-white/60 text-sm">
                      Type: {item.type === 'video' ? 'Video' : 'Image'}
                    </div>
                  </div>

                  {/* Primary Actions */}
                  <div className="space-y-3">
                    <motion.button
                      onClick={() => onAction?.('recreate', item)}
                      className="w-full bg-fine-gradient text-white py-3 px-4 rounded-lg font-medium flex items-center justify-between fine-hover-glow"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Recreate</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-sm">{creditCost.recreate}</span>
                        <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                      </div>
                    </motion.button>

                    <motion.button
                      onClick={() => onAction?.('download', item)}
                      className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </motion.button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="space-y-2">
                    <motion.button
                      onClick={() => onAction?.('remix', item)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 px-4 rounded-lg text-sm flex items-center justify-between transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center space-x-2">
                        <Shuffle className="w-4 h-4" />
                        <span>Remix</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs">{creditCost.remix}</span>
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      </div>
                    </motion.button>

                    <motion.button
                      onClick={() => onAction?.('upscale', item)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 px-4 rounded-lg text-sm flex items-center justify-between transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center space-x-2">
                        <ArrowUp className="w-4 h-4" />
                        <span>Upscale</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs">{creditCost.upscale}</span>
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      </div>
                    </motion.button>

                    {item.type === 'image' && (
                      <motion.button
                        onClick={() => onAction?.('makeVideo', item)}
                        className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 px-4 rounded-lg text-sm flex items-center justify-between transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center space-x-2">
                          <Video className="w-4 h-4" />
                          <span>Make Video</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs">{creditCost.makeVideo}</span>
                          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        </div>
                      </motion.button>
                    )}
                  </div>

                  {/* Navigation Info */}
                  {items.length > 1 && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-white/60 text-sm text-center">
                        {currentIndex + 1} of {items.length}
                      </div>
                      <div className="text-white/40 text-xs text-center mt-1">
                        Use ← → keys to navigate
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 