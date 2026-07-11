import fs from 'fs'
import path from 'path'
import guidesMeta from '@/data/guides-meta.json'

export interface Guide {
  slug: string
  title: string
  excerpt: string
  content: string
  /** Hero image path under public/, present when images/guides/<slug>.jpg exists. */
  image?: string
}

// Canonical display order + nav labels. Single source of truth for the set of
// guides, shared with scripts/build-guides-manifest.mjs (which emits the
// machine-readable manifest the gameserver reads) and validated against the
// markdown files in public/guides/ by that script and guides.test.ts.
const GUIDE_ORDER: { slug: string; label: string }[] = guidesMeta

const GUIDES_DIR = path.join(process.cwd(), 'public', 'guides')

/** Parse the first H1 as the title and the first body paragraph as the excerpt. */
function parseGuide(slug: string, raw: string): Guide {
  const lines = raw.split('\n')

  let title = slug
  let excerpt = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!title || title === slug) {
      if (line.startsWith('# ')) {
        title = line.replace(/^#\s+/, '').trim()
        continue
      }
    }
    // First non-empty, non-heading, non-rule line after the title is the excerpt.
    if (title !== slug && line && !line.startsWith('#') && line !== '---') {
      excerpt = line.replace(/\*\*/g, '')
      break
    }
  }

  return { slug, title, excerpt, content: raw }
}

const GUIDE_IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'guides')

/** Hero image convention: public/images/guides/<slug>.jpg (optional per guide). */
function guideImage(slug: string): string | undefined {
  return fs.existsSync(path.join(GUIDE_IMAGES_DIR, `${slug}.jpg`))
    ? `/images/guides/${slug}.jpg`
    : undefined
}

function readGuide(slug: string): Guide | undefined {
  const filePath = path.join(GUIDES_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return undefined
  const raw = fs.readFileSync(filePath, 'utf-8')
  return { ...parseGuide(slug, raw), image: guideImage(slug) }
}

export function getAllGuides(): Guide[] {
  return GUIDE_ORDER.map(({ slug }) => readGuide(slug)).filter(
    (g): g is Guide => g !== undefined,
  )
}

export function getGuideBySlug(slug: string): Guide | undefined {
  if (!GUIDE_ORDER.some((g) => g.slug === slug)) return undefined
  return readGuide(slug)
}

export function getGuideLabel(slug: string): string {
  return GUIDE_ORDER.find((g) => g.slug === slug)?.label ?? slug
}
