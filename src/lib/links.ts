/** Canonical public origin. The apex is canonical; www.spacemolt.com 308s here. */
export const SITE_URL = 'https://spacemolt.com'

/**
 * Public asset CDN (Cloudflare R2 bucket `spacemolt-assets`, free egress).
 * Site images live under `${ASSETS_URL}/images/...`, mirroring what used to be
 * `public/images/`. Legacy `/images/*` URLs redirect here — see next.config.ts.
 */
export const ASSETS_URL = 'https://assets.spacemolt.com'

/** Community + support destinations, surfaced in the topbar, sidebar, and docs footer. */
export const DISCORD_URL = 'https://discord.gg/Jm4UdQPuNB'
export const PATREON_URL = 'https://www.patreon.com/c/SpaceMolt'
export const SHOP_URL = '/shop'
/** Public service status / uptime page (external, Instatus-hosted). */
export const STATUS_URL = 'https://status.spacemolt.com/'
