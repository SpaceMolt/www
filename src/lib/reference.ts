import fs from 'fs'
import path from 'path'
import referenceMeta from '@/data/reference-meta.json'

export interface ReferencePage {
  slug: string
  label: string
  category: string
  title: string
  excerpt: string
  content: string
}

export interface ReferenceCategory {
  category: string
  pages: ReferencePage[]
}

// Canonical order + labels + category grouping. Same pattern as guides
// (src/lib/guides.ts): the markdown in public/reference/ is the content,
// this meta file is the single source of truth for the set of pages.
const REFERENCE_ORDER: { slug: string; label: string; category: string }[] =
  referenceMeta

const REFERENCE_DIR = path.join(process.cwd(), 'public', 'reference')

/** Parse the first H1 as the title and the first body paragraph as the excerpt. */
function parseReference(
  meta: { slug: string; label: string; category: string },
  raw: string,
): ReferencePage {
  const lines = raw.split('\n')

  let title = ''
  let excerpt = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!title) {
      if (line.startsWith('# ')) {
        title = line.replace(/^#\s+/, '').trim()
      }
      continue
    }
    // First non-empty, non-heading, non-rule line after the title is the excerpt.
    if (line && !line.startsWith('#') && line !== '---') {
      excerpt = line.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      break
    }
  }

  return { ...meta, title: title || meta.label, excerpt, content: raw }
}

function readReference(meta: {
  slug: string
  label: string
  category: string
}): ReferencePage | undefined {
  const filePath = path.join(REFERENCE_DIR, `${meta.slug}.md`)
  if (!fs.existsSync(filePath)) return undefined
  const raw = fs.readFileSync(filePath, 'utf-8')
  return parseReference(meta, raw)
}

export function getAllReferencePages(): ReferencePage[] {
  return REFERENCE_ORDER.map((meta) => readReference(meta)).filter(
    (p): p is ReferencePage => p !== undefined,
  )
}

/** Pages grouped by category, categories in first-appearance order. */
export function getReferenceCategories(): ReferenceCategory[] {
  const groups: ReferenceCategory[] = []
  for (const page of getAllReferencePages()) {
    const group = groups.find((g) => g.category === page.category)
    if (group) {
      group.pages.push(page)
    } else {
      groups.push({ category: page.category, pages: [page] })
    }
  }
  return groups
}

export function getReferenceBySlug(slug: string): ReferencePage | undefined {
  const meta = REFERENCE_ORDER.find((m) => m.slug === slug)
  if (!meta) return undefined
  return readReference(meta)
}

/** Previous/next page in canonical order, for footer pagination. */
export function getReferenceNeighbors(slug: string): {
  prev?: { slug: string; label: string }
  next?: { slug: string; label: string }
} {
  const i = REFERENCE_ORDER.findIndex((m) => m.slug === slug)
  if (i === -1) return {}
  return {
    prev: i > 0 ? REFERENCE_ORDER[i - 1] : undefined,
    next: i < REFERENCE_ORDER.length - 1 ? REFERENCE_ORDER[i + 1] : undefined,
  }
}
