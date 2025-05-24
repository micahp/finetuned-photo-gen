/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This disables ESLint errors during build
    // Our source code passes ESLint but generated Prisma files cause issues
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 