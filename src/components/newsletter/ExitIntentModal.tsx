'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NewsletterSignup } from './NewsletterSignup'
import { Gift, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExitIntentModal() {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const handleMouseLeave = useCallback(
    (e: MouseEvent) => {
      // Only fire when mouse leaves THROUGH the top of the page
      if (e.clientY <= 0 && !dismissed && !open) {
        setOpen(true)
      }
    },
    [dismissed, open]
  )

  useEffect(() => {
    // Check if user already dismissed in this session
    const alreadyDismissed = sessionStorage.getItem('exit_intent_dismissed')
    if (alreadyDismissed) {
      setDismissed(true)
      return
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [handleMouseLeave])

  const handleDismiss = () => {
    setOpen(false)
    setDismissed(true)
    sessionStorage.setItem('exit_intent_dismissed', 'true')
  }

  const handleSuccess = () => {
    // Close modal after successful signup
    setTimeout(() => {
      setOpen(false)
      setDismissed(true)
      sessionStorage.setItem('exit_intent_dismissed', 'true')
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-700">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/20">
            <Gift className="h-6 w-6 text-brand-blue" />
          </div>
          <DialogTitle className="text-center text-xl text-white">
            Wait! Get 50 Free Credits
          </DialogTitle>
          <DialogDescription className="text-center text-gray-300">
            Subscribe to the Innovative Hype newsletter and get 50 bonus AI photo
            generation credits — plus weekly AI tips, tools, and exclusive deals.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <NewsletterSignup
            source="exit_intent"
            variant="compact"
            placeholder="your@email.com"
            buttonText="Get Free Credits"
            onSuccess={handleSuccess}
          />
        </div>
        <p className="text-xs text-center text-gray-500 mt-2">
          * Free credits offer available for new subscribers only. One per person.
        </p>
      </DialogContent>
    </Dialog>
  )
}
