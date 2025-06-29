'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Clock, Gift } from 'lucide-react';

interface CreditPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim?: () => void;
  credits?: number;
  timeDelayMs?: number;
  enableExitIntent?: boolean;
}

export function CreditPopup({ 
  isOpen, 
  onClose, 
  onClaim,
  credits = 20,
  timeDelayMs = 30000, // 30 seconds
  enableExitIntent = true 
}: CreditPopupProps) {
  const [showTimeDelayed, setShowTimeDelayed] = useState(false);
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Time-delayed popup
  useEffect(() => {
    if (timeDelayMs > 0) {
      const timer = setTimeout(() => {
        setShowTimeDelayed(true);
      }, timeDelayMs);

      return () => clearTimeout(timer);
    }
  }, [timeDelayMs]);

  // Exit-intent detection
  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (enableExitIntent && e.clientY <= 0 && !showTimeDelayed && !showExitIntent) {
      setShowExitIntent(true);
    }
  }, [enableExitIntent, showTimeDelayed, showExitIntent]);

  useEffect(() => {
    if (enableExitIntent) {
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => document.removeEventListener('mouseleave', handleMouseLeave);
    }
  }, [handleMouseLeave, enableExitIntent]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      onClaim?.();
      onClose();
    }, 1500);
  };

  const shouldShow = isOpen || showTimeDelayed || showExitIntent;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Popup Content */}
          <motion.div
            className="relative w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Content */}
            <div className="text-center space-y-6">
              {/* Icon */}
              <motion.div
                className="w-16 h-16 mx-auto bg-photoai-gradient rounded-full flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Gift className="w-8 h-8 text-white" />
              </motion.div>

              {/* Headline */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Get {credits} Free Credits!
                </h2>
                <p className="text-white/80 text-sm">
                  {showExitIntent 
                    ? "Wait! Don't leave empty-handed" 
                    : "Limited time offer for new users"
                  }
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-8 h-8 bg-photoai-accent-cyan/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-photoai-accent-cyan" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">Generate {Math.floor(credits / 2)} images</div>
                    <div className="text-white/60 text-xs">High-quality AI photos</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-8 h-8 bg-photoai-accent-purple/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-photoai-accent-purple" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">No expiration</div>
                    <div className="text-white/60 text-xs">Use them whenever you want</div>
                  </div>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 rounded-lg border border-white/20 focus:border-photoai-accent-cyan focus:outline-none transition-colors"
                    required
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-photoai-gradient text-white py-3 px-6 rounded-lg font-semibold photoai-hover-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Claiming...</span>
                    </div>
                  ) : (
                    `Claim ${credits} Free Credits`
                  )}
                </motion.button>
              </form>

              {/* Trust Indicators */}
              <div className="text-center space-y-2">
                <div className="text-white/60 text-xs">
                  ✓ No credit card required
                </div>
                <div className="text-white/60 text-xs">
                  ✓ Instant access • ✓ Cancel anytime
                </div>
              </div>

              {/* Urgency */}
              {showExitIntent && (
                <motion.div
                  className="bg-red-500/20 border border-red-500/30 rounded-lg p-3"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-red-400 text-sm font-medium">
                    ⏰ This offer expires when you leave
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 