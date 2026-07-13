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
      { source: '/skills.md', destination: `${GAMESERVER_URL}/skill.md` },
      // NOTE: /docs used to proxy the gameserver skill.md; it is now the
      // website's reference index. Agent docs remain at /skill.md and /skill.

      // Gameserver proxies
      { source: '/api/docs', destination: `${GAMESERVER_URL}/api/docs` },
      { source: '/api/openapi.json', destination: `${GAMESERVER_URL}/api/openapi.json` },
      { source: '/api/v2/docs', destination: `${GAMESERVER_URL}/api/v2/docs` },
      { source: '/api/v2/openapi.json', destination: `${GAMESERVER_URL}/api/v2/openapi.json` },
    ]
  },
  async redirects() {
    return [
      // MCP — redirect so clients connect directly to the gameserver
      { source: '/mcp', destination: `${GAMESERVER_URL}/mcp`, permanent: true },
      { source: '/mcp/v2', destination: `${GAMESERVER_URL}/mcp/v2`, permanent: false },
      { source: '/mcp/docs', destination: `${GAMESERVER_URL}/mcp/docs`, permanent: false },

      // Blog → News redirect
      { source: '/blog', destination: '/news', permanent: true },
      { source: '/blog/:path*', destination: '/news/:path*', permanent: true },

      // Docs overhaul (2026-07): everything lives under /docs now.
      { source: '/features', destination: '/docs', permanent: true },
      { source: '/getting-started', destination: '/docs/getting-started', permanent: true },
      { source: '/reference', destination: '/docs', permanent: true },
      { source: '/reference/:path*', destination: '/docs/:path*', permanent: true },
      { source: '/clients', destination: '/docs/game-clients', permanent: true },
      // /guides page moves, but the raw files under public/guides/ (index.json
      // and <slug>.md) are a gameserver contract (get_guide) and MUST keep
      // resolving — so only redirect extensionless paths.
      { source: '/guides', destination: '/docs/guides', permanent: true },
      { source: '/guides/:slug([^.]+)', destination: '/docs/guides/:slug', permanent: true },

      // The ship browser moved into the codex alongside every other data section.
      { source: '/ships', destination: '/codex/ships', permanent: true },

      // Legacy HTML redirects
      { source: '/terms.html', destination: '/terms', permanent: true },
      { source: '/forum.html', destination: '/forum', permanent: true },
      { source: '/clients.html', destination: '/docs/game-clients', permanent: true },

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
      {
        source: '/id-migrations.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
      {
        source: '/changelog',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60' },
        ],
      },
    ]
  },
}

export default nextConfig
