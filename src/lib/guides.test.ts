import { describe, it, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'
import guidesMeta from '@/data/guides-meta.json'
import { getAllGuides, getGuideBySlug, getGuideLabel } from './guides'

const GUIDES_DIR = path.join(process.cwd(), 'public', 'guides')

const fileSlugs = fs
  .readdirSync(GUIDES_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''))

const metaSlugs = guidesMeta.map((m) => m.slug)

describe('guides metadata / file parity', () => {
  // This mirrors the gate in scripts/build-guides-manifest.mjs. The set of
  // markdown files and the guides-meta.json entries must match exactly, so the
  // human /guides menu and the gameserver get_guide list never drift from the
  // files on disk.
  it('every guide file has a guides-meta.json entry', () => {
    const missing = fileSlugs.filter((s) => !metaSlugs.includes(s))
    expect(missing).toEqual([])
  })

  it('every guides-meta.json entry has a guide file', () => {
    const missing = metaSlugs.filter((s) => !fileSlugs.includes(s))
    expect(missing).toEqual([])
  })

  it('every entry has a non-empty label', () => {
    for (const { slug, label } of guidesMeta) {
      expect(label, `label for ${slug}`).toBeTruthy()
    }
  })
})

describe('guide loading', () => {
  it('loads every guide with a parsed title and excerpt', () => {
    const guides = getAllGuides()
    expect(guides.length).toBe(metaSlugs.length)
    for (const g of guides) {
      expect(g.title, `title for ${g.slug}`).toBeTruthy()
      expect(g.excerpt, `excerpt for ${g.slug}`).toBeTruthy()
    }
  })

  it('returns guides in guides-meta.json order', () => {
    expect(getAllGuides().map((g) => g.slug)).toEqual(metaSlugs)
  })

  it('getGuideBySlug rejects unknown slugs', () => {
    expect(getGuideBySlug('not-a-real-guide')).toBeUndefined()
  })

  it('getGuideLabel returns the configured label', () => {
    expect(getGuideLabel('pirate-hunter')).toBe('Pirate Hunter')
  })
})
