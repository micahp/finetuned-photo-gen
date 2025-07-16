import { TextEncoder, TextDecoder } from 'util'

// Ensure TextEncoder and TextDecoder are available globally before other modules load.
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder
} 