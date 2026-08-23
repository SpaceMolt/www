import manifest from './imageManifest.json'
import { ASSETS_URL } from '@/lib/links'

/**
 * Every image key present in the asset bucket (`assets.spacemolt.com/images/...`).
 *
 * Art no longer lives in the repo, so pages that must not render a broken image
 * ask this instead of the filesystem. Regenerate after uploading new art:
 *
 *   set -a; source <(cat production.env); set +a
 *   bun ../../scripts/r2-upload.ts <dir> spacemolt-assets images
 *   bun ../../scripts/r2-manifest.ts spacemolt-assets images/ src/data/imageManifest.json
 */
const KEYS = new Set(manifest as string[])

/** True when `<ASSETS_URL>/images/<path>` exists. `path` has no leading slash. */
export function hasImage(path: string): boolean {
  return KEYS.has(`images/${path}`)
}

/** Absolute CDN URL for an image path, with no existence check. */
export function imageUrl(path: string): string {
  return `${ASSETS_URL}/images/${path}`
}
