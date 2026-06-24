#!/usr/bin/env node

/**
 * Generates public/guides/index.json — the machine-readable manifest of
 * available guides that the gameserver fetches at runtime to populate its
 * get_guide command (list of valid guides + titles/descriptions).
 *
 * The manifest is derived from two inputs:
 *   - src/data/guides-meta.json — hand-maintained display order + nav labels
 *   - public/guides/*.md        — the actual guide content
 *
 * This script is the parity gate: if the markdown files and guides-meta.json
 * disagree (a guide added to one but not the other), it exits non-zero so the
 * `lint` / `build` steps fail in CI. That keeps the human /guides menu and the
 * gameserver API list from drifting out of sync with the files on disk.
 *
 * Run as a prebuild/prelint step. Output is a build artifact (gitignored).
 *
 * Usage: node scripts/build-guides-manifest.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const META_PATH = resolve(ROOT, 'src', 'data', 'guides-meta.json')
const GUIDES_DIR = resolve(ROOT, 'public', 'guides')
const OUT_PATH = resolve(GUIDES_DIR, 'index.json')

/** Parse the first H1 as the title and the first body paragraph as the excerpt. */
function parseGuide(slug, raw) {
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
      excerpt = line.replace(/\*\*/g, '')
      break
    }
  }

  return { slug, title, excerpt }
}

function main() {
  const meta = JSON.parse(readFileSync(META_PATH, 'utf-8'))
  const metaSlugs = meta.map((m) => m.slug)

  const fileSlugs = readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))

  // Parity check: every markdown file must have a meta entry and vice versa.
  const missingFromMeta = fileSlugs.filter((s) => !metaSlugs.includes(s))
  const missingFiles = metaSlugs.filter((s) => !fileSlugs.includes(s))

  if (missingFromMeta.length || missingFiles.length) {
    console.error('Guide manifest is out of sync:')
    if (missingFromMeta.length) {
      console.error(
        `  guide files with no entry in src/data/guides-meta.json: ${missingFromMeta.join(', ')}`,
      )
    }
    if (missingFiles.length) {
      console.error(
        `  guides-meta.json entries with no public/guides/<slug>.md file: ${missingFiles.join(', ')}`,
      )
    }
    console.error(
      'Add the guide to both places (or remove it from both) so the human menu and the gameserver API stay in sync.',
    )
    process.exit(1)
  }

  const guides = meta.map(({ slug, label }) => {
    const raw = readFileSync(resolve(GUIDES_DIR, `${slug}.md`), 'utf-8')
    const { title, excerpt } = parseGuide(slug, raw)
    return { slug, label, title, excerpt }
  })

  const manifest = {
    guides,
    generatedAt: new Date().toISOString(),
  }

  writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`  Wrote guides manifest: ${guides.length} guides → public/guides/index.json`)
}

main()
