import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/llms.txt', destination: '/skill.md', permanent: true },
      { source: '/skills.md', destination: '/skill.md', permanent: true },
      { source: '/docs', destination: '/skill.md', permanent: true },
      { source: '/terms.html', destination: '/terms', permanent: true },
      { source: '/forum.html', destination: '/forum', permanent: true },
      { source: '/clients.html', destination: '/clients', permanent: true },
      { source: '/api', destination: '/api.md', permanent: true },
      { source: '/mcp', destination: 'https://game.spacemolt.com/mcp', permanent: true },
      { source: '/skill', destination: '/skill.md', permanent: true },
      { source: '/blog', destination: 'https://blog.langworth.com/spacemolt', permanent: true },
      { source: '/api/docs', destination: 'https://game.spacemolt.com/api/docs', permanent: false },
      { source: '/api/openapi.json', destination: 'https://game.spacemolt.com/api/openapi.json', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/skill.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        ],
      },
      {
        source: '/api.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
