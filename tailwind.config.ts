import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Prevent CSS purging issues in development
  safelist: [
    // Common utility patterns that might get purged
    {
      pattern: /^(bg|text|border|hover|focus|active|group-hover)-(gray|red|green|blue|yellow|purple|pink|indigo)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    {
      pattern: /^(w|h|p|m|space|gap)-(1|2|3|4|5|6|8|10|12|16|20|24|32|40|48|64)$/,
    },
    // Specific classes used in the app
    'opacity-0',
    'opacity-100',
    'group-hover:opacity-100',
    'transition-opacity',
    'truncate',
    'leading-tight',
    // PhotoAI-inspired classes
    {
      pattern: /^(bg|text|border|shadow)-(neon|photoai)-(cyan|purple|pink|blue|green)(-.*)?$/,
    },
    'backdrop-blur-glass',
    'bg-dark-glass',
  ],
  theme: {
  	extend: {
  		colors: {
        brand: {
          blue: '#007CF0',
          purple: '#8A2BE2',
          cyan: '#00DFD8',
        },
        // PhotoAI-inspired neon colors
        neon: {
          cyan: '#00FFFF',
          purple: '#B347FF',
          pink: '#FF47B3',
          blue: '#4747FF',
          green: '#47FF47',
        },
        // PhotoAI dark theme colors
        photoai: {
          dark: '#0A0A0A',
          'dark-lighter': '#1A1A1A',
          'dark-glass': 'rgba(10, 10, 10, 0.8)',
          'accent-cyan': '#00DFD8',
          'accent-purple': '#8A2BE2',
          'text-muted': '#888888',
        },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
      // PhotoAI-inspired animations and effects
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%': { 
            boxShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
          },
          '100%': { 
            boxShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor',
          },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      // Glass morphism utilities
      backdropBlur: {
        'glass': '16px',
      },
      backgroundColor: {
        'dark-glass': 'rgba(10, 10, 10, 0.8)',
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
  // Development optimizations
  experimental: {
    optimizeUniversalDefaults: true
  }
} satisfies Config;
