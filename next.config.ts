import type { NextConfig } from 'next'

const GAMESERVER_URL = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Documentation — proxied from the gameserver (not redirected, so clients
      // that can't follow redirects still get the content)
      { source: '/api.md', destination: `${GAMESERVER_URL}/api.md` },
      { source: '/api', destination: `${GAMESERVER_URL}/api.md` },
      { source: '/skill.md', destination: `${GAMESERVER_URL}/skill.md` },
      { source: '/skill', destination: `${GAMESERVER_URL}/skill.md` },
      { source: '/llms.txt', destination: `${GAMESERVER_URL}/skill.md` },
      { source: '/skills.md', destination: `${GAMESERVER_URL}/skill.md` },
      { source: '/docs', destination: `${GAMESERVER_URL}/skill.md` },

      // Gameserver proxies
      { source: '/api/docs', destination: `${GAMESERVER_URL}/api/docs` },
      { source: '/api/openapi.json', destination: `${GAMESERVER_URL}/api/openapi.json` },
    ]
  },
  async redirects() {
    return [
      // MCP — redirect so clients connect directly to the gameserver
      { source: '/mcp', destination: `${GAMESERVER_URL}/mcp`, permanent: true },

      // Blog → News redirect
      { source: '/blog', destination: '/news', permanent: true },
      { source: '/blog/:path*', destination: '/news/:path*', permanent: true },

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
