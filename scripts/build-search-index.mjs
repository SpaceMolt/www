#!/usr/bin/env node

/**
 * Builds the Pagefind search index from Next's prerendered HTML output.
 *
 * Pagefind is a static-site indexer: it reads the HTML that `next build`
 * already wrote to .next/server/app and produces a chunked index under
 * public/pagefind/, which the browser loads on demand from /pagefind/.
 *
 * Only pages carrying `data-pagefind-body` are indexed — that attribute lives
 * on <main id="console-main"> (see ConsoleShell), so the console routes are in
 * and the marketing/(site) group is out. Chrome that repeats on every page
 * (topbar, sidebar, live pane, community footer) is marked data-pagefind-ignore
 * so it never becomes a match.
 *
 * This MUST run AFTER `next build` — there is no HTML to read before then.
 * A missing or empty index is worse than a failed build (search silently
 * returns nothing on production), so both cases exit non-zero.
 *
 * Usage: node scripts/build-search-index.mjs
 */

import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import * as pagefind from 'pagefind'

const ROOT = resolve(import.meta.dirname, '..')
// Overridable so the script can be pointed at a fixture directory when testing.
const SOURCE_DIR = process.env.PAGEFIND_SOURCE ?? resolve(ROOT, '.next', 'server', 'app')
const OUTPUT_DIR = process.env.PAGEFIND_OUTPUT ?? resolve(ROOT, 'public', 'pagefind')

function fail(message) {
  console.error(`\n[build-search-index] ${message}\n`)
  process.exit(1)
}

if (!existsSync(SOURCE_DIR)) {
  fail(
    `No prerendered HTML at ${SOURCE_DIR}.\n` +
      `This step must run after \`next build\`. Without it the site ships with no search index.`
  )
}

// Stale chunks from a previous build would otherwise linger alongside the new ones.
rmSync(OUTPUT_DIR, { recursive: true, force: true })

const { index, errors: createErrors } = await pagefind.createIndex()
if (!index) fail(`Could not create the index: ${createErrors.join(', ')}`)

const { errors: addErrors, page_count: pageCount } = await index.addDirectory({ path: SOURCE_DIR })
if (addErrors.length > 0) fail(`Indexing failed: ${addErrors.join(', ')}`)

if (pageCount === 0) {
  fail(
    `Indexed 0 pages from ${SOURCE_DIR}.\n` +
      `Pagefind only indexes pages containing a data-pagefind-body element — check that ` +
      `<main id="console-main"> in ConsoleShell still carries that attribute.`
  )
}

const { errors: writeErrors } = await index.writeFiles({ outputPath: OUTPUT_DIR })
if (writeErrors.length > 0) fail(`Writing the index failed: ${writeErrors.join(', ')}`)

await pagefind.close()

console.log(`[build-search-index] Indexed ${pageCount} pages -> ${OUTPUT_DIR}`)
