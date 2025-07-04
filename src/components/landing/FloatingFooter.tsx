'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { MessageCircle, Heart, ExternalLink } from 'lucide-react';

interface FloatingFooterProps {
  className?: string;
  creator?: {
    name: string;
    avatar?: string;
    url?: string;
  };
  showFeedback?: boolean;
}

export function FloatingFooter({ 
  className = '', 
  creator,
  showFeedback = true 
}: FloatingFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultCreator = {
    name: "PhotoAI Team",
    avatar: "P",
    url: "https://photoai.com"
  };

  const displayCreator = creator || defaultCreator;

  return (
    <>
      {/* Floating Footer Strip */}
      <motion.div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-fine-dark/90 backdrop-blur-md border-t border-white/10 ${className}`}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            {/* Creator Attribution */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-white/60 text-sm">Created by</span>
                <a
                  href={displayCreator.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white hover:text-fine-accent-cyan transition-colors"
                >
                  {displayCreator.avatar ? (
                    <img 
                      src={displayCreator.avatar} 
                      alt={displayCreator.name}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 bg-fine-gradient rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {displayCreator.avatar || displayCreator.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium">{displayCreator.name}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Center - Social Proof */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-white/60 text-sm">
                <Heart className="w-4 h-4 text-red-400" />
                <span>Loved by 10k+ creators</span>
              </div>
            </div>

            {/* Right - Quick Links */}
            <div className="flex items-center space-x-4">
              <a
                href="/privacy"
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Feedback Widget (Featurebase-style) */}
      {showFeedback && (
        <motion.div
          className="fixed bottom-20 right-6 z-50"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 2 }}
        >
          <div className="relative">
            {/* Feedback Button */}
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-12 h-12 bg-fine-gradient rounded-full shadow-lg flex items-center justify-center fine-hover-glow"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </motion.button>

            {/* Feedback Panel */}
            {isExpanded && (
              <motion.div
                className="absolute bottom-16 right-0 w-80 glass-panel p-4 rounded-lg shadow-2xl"
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">
                      How's your experience?
                    </h3>
                    <p className="text-white/60 text-xs">
                      Your feedback helps us improve PhotoAI
                    </p>
                  </div>

                  {/* Quick Feedback Options */}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-white/10 hover:bg-white/20 text-white text-xs py-2 px-3 rounded transition-colors">
                      🎉 Love it
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 text-white text-xs py-2 px-3 rounded transition-colors">
                      🐛 Bug report
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 text-white text-xs py-2 px-3 rounded transition-colors">
                      💡 Feature idea
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 text-white text-xs py-2 px-3 rounded transition-colors">
                      ❓ Question
                    </button>
                  </div>

                  {/* Text Input */}
                  <textarea
                    placeholder="Tell us more... (optional)"
                    className="w-full bg-white/10 text-white placeholder-white/40 text-xs p-2 rounded border border-white/20 focus:border-fine-accent-cyan focus:outline-none resize-none"
                    rows={3}
                  />

                  {/* Submit Button */}
                  <button className="w-full bg-fine-gradient text-white text-xs py-2 rounded font-medium fine-hover-glow">
                    Send Feedback
                  </button>
                </div>
              </motion.div>
            )}

            {/* Pulse Indicator */}
            {!isExpanded && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
      )}
    </>
  );
} 