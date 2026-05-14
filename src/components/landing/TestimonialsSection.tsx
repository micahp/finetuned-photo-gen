'use client'

import { Star } from 'lucide-react'

interface Testimonial {
  name: string
  role: string
  avatar: string
  content: string
  rating: number
}

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Content Creator',
    avatar: 'SC',
    content: 'Fine Photo Gen completely transformed my content workflow. I can generate on-brand photos in seconds instead of hours of shooting and editing. The model captures my likeness perfectly.',
    rating: 5,
  },
  {
    name: 'Marcus Johnson',
    role: 'Real Estate Photographer',
    avatar: 'MJ',
    content: 'I was skeptical about AI photos, but the quality blew me away. I use it for virtual staging and property previews. Saved me thousands in traditional photography costs.',
    rating: 5,
  },
  {
    name: 'Elena Rodriguez',
    role: 'Social Media Manager',
    avatar: 'ER',
    content: 'Managing 5 brand accounts was killing me. Now I train a model per client and generate on-brand content in bulk. My clients love the consistency. Game-changer.',
    rating: 5,
  },
  {
    name: 'David Park',
    role: 'E-commerce Entrepreneur',
    avatar: 'DP',
    content: "We used to spend $2k/month on product photos. Now with Fine Photo Gen's video generation AND photo capabilities, we've cut our creative budget by 80% while increasing output.",
    rating: 5,
  },
]

export function TestimonialsSection() {
  return (
    <div className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Star className="h-4 w-4 fill-current" />
            Rated 4.9/5 by creators
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Loved by Creators Worldwide
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of photographers, content creators, and businesses who trust
            Fine Photo Gen for their AI-powered visuals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-bold text-sm">
                  {t.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{t.name}</div>
                  <div className="text-sm text-gray-500">{t.role}</div>
                </div>
              </div>
              <div className="flex mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 leading-relaxed">&ldquo;{t.content}&rdquo;</p>
            </div>
          ))}
        </div>

        {/* Social proof metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mt-16 pt-12 border-t border-gray-200">
          {[
            { value: '10K+', label: 'Models Trained' },
            { value: '2M+', label: 'Images Generated' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '24/7', label: 'Support' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-brand-blue">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
