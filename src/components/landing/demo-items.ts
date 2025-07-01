export interface DemoItem {
  id: string
  src: string
  alt: string
  category: string
}

// Temporary static demo items; replace with API data later
export const demoItems: DemoItem[] = [
  {
    id: '1',
    src: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=800&q=60',
    alt: 'Portrait in neon lighting',
    category: 'portrait'
  },
  {
    id: '2',
    src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=60',
    alt: 'Landscape city at night',
    category: 'landscape'
  },
  {
    id: '3',
    src: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=800&q=60',
    alt: 'Artistic abstract colors',
    category: 'artistic'
  },
  {
    id: '4',
    src: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=60',
    alt: 'Professional business headshot',
    category: 'professional'
  },
  {
    id: '5',
    src: 'https://images.unsplash.com/photo-1504208434309-cb69f4fe52b0?auto=format&fit=crop&w=800&q=60',
    alt: 'Casual street style',
    category: 'casual'
  },
  {
    id: '6',
    src: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=60',
    alt: 'Outdoor adventure scene',
    category: 'outdoor'
  },
  {
    id: '7',
    src: 'https://images.unsplash.com/photo-1454023492550-5696f8ff10e1?auto=format&fit=crop&w=800&q=60',
    alt: 'Vintage cinematic still',
    category: 'vintage'
  },
  {
    id: '8',
    src: '/images/flux-dev.webp',
    alt: 'Flux Dev Model',
    category: 'featured'
  },
  {
    id: '9',
    src: '/images/flux-pro-ultra.webp',
    alt: 'Flux Pro Ultra Model',
    category: 'featured'
  },
  {
    id: '10',
    src: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=60',
    alt: 'Colorful festival scene',
    category: 'colorful'
  },
  {
    id: '11',
    src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=60',
    alt: 'Monochrome architecture shot',
    category: 'monochrome'
  },
  {
    id: '12',
    src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=60',
    alt: 'Fantasy landscape',
    category: 'fantasy'
  }
] 