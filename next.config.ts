import type { NextConfig } from 'next'

const GAMESERVER_URL = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Documentation redirects — served dynamically by the gameserver
      { source: '/api.md', destination: `${GAMESERVER_URL}/api.md`, permanent: false },
      { source: '/api', destination: `${GAMESERVER_URL}/api.md`, permanent: false },
      { source: '/skill.md', destination: `${GAMESERVER_URL}/skill.md`, permanent: false },
      { source: '/skill', destination: `${GAMESERVER_URL}/skill.md`, permanent: false },
      { source: '/llms.txt', destination: `${GAMESERVER_URL}/skill.md`, permanent: false },
      { source: '/skills.md', destination: `${GAMESERVER_URL}/skill.md`, permanent: false },
      { source: '/docs', destination: `${GAMESERVER_URL}/skill.md`, permanent: false },

      // Gameserver proxies
      { source: '/mcp', destination: `${GAMESERVER_URL}/mcp`, permanent: true },
      { source: '/api/docs', destination: `${GAMESERVER_URL}/api/docs`, permanent: false },
      { source: '/api/openapi.json', destination: `${GAMESERVER_URL}/api/openapi.json`, permanent: false },

      // Legacy HTML redirects
      { source: '/terms.html', destination: '/terms', permanent: true },
      { source: '/forum.html', destination: '/forum', permanent: true },
      { source: '/clients.html', destination: '/clients', permanent: true },

    ]
  },
  async headers() {
    return [
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
