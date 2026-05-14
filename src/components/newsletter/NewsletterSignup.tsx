'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Mail, CheckCircle } from 'lucide-react'

interface NewsletterSignupProps {
  source?: 'landing_page' | 'exit_intent' | 'footer' | 'checkout'
  title?: string
  description?: string
  buttonText?: string
  placeholder?: string
  variant?: 'default' | 'compact' | 'hero'
  onSuccess?: () => void
}

export function NewsletterSignup({
  source = 'landing_page',
  title = 'Stay in the loop',
  description = 'Get AI photo tips, new features, and exclusive offers from Innovative Hype.',
  buttonText = 'Subscribe',
  placeholder = 'you@email.com',
  variant = 'default',
  onSuccess,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim()) return

      setLoading(true)
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), source }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        setSubscribed(true)
        toast.success(data.message || 'Subscribed!')
        onSuccess?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [email, source, onSuccess]
  )

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-5 w-5" />
        <span className="font-medium">You're subscribed!</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          required
          className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <Button type="submit" disabled={loading} size="sm" className="bg-brand-blue hover:bg-blue-700 whitespace-nowrap">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
        </Button>
      </form>
    )
  }

  if (variant === 'hero') {
    return (
      <div className="max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="flex shadow-lg rounded-lg overflow-hidden">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              required
              className="w-full pl-10 pr-4 py-4 text-base rounded-l-lg border-0 focus:ring-2 focus:ring-brand-blue focus:outline-none"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="rounded-l-none px-8 py-4 text-base font-semibold bg-brand-blue hover:bg-blue-700"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : buttonText}
          </Button>
        </form>
        <p className="text-xs text-gray-300 mt-2 text-center">
          No spam, ever. Unsubscribe anytime.
        </p>
      </div>
    )
  }

  // default variant
  return (
    <div className="space-y-3">
      {title && <h4 className="font-semibold text-white">{title}</h4>}
      {description && <p className="text-sm text-gray-300">{description}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          required
          className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <Button type="submit" disabled={loading} size="sm" className="bg-brand-blue hover:bg-blue-700 whitespace-nowrap">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonText}
        </Button>
      </form>
      <p className="text-xs text-gray-400">No spam. Unsubscribe anytime.</p>
    </div>
  )
}
