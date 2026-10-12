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

// New mobile-base art ships locally until it is published to the asset bucket.
const LOCAL_IMAGES: Record<string, string> = Object.fromEntries(
  ['civitas', 'siege_foundry', 'nebula_foundation', 'here_to_stay', 'emanation'].map(
    (id) => [`ships/catalog/${id}.webp`, `/images/ships/mobile-bases/${id}.webp`],
  ),
)

/** True when an image exists locally or in the asset bucket. No leading slash. */
export function hasImage(path: string): boolean {
  return Object.hasOwn(LOCAL_IMAGES, path) || KEYS.has(`images/${path}`)
}

/** Local or CDN URL for an image path, with no existence check. */
export function imageUrl(path: string): string {
  return LOCAL_IMAGES[path] ?? `${ASSETS_URL}/images/${path}`
}
