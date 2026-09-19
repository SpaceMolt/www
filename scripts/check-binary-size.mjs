import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAX_BINARY_BYTES = 500 * 1024

export function parseNumstat(output) {
  return output
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const [added, deleted, ...pathParts] = record.split('\t')
      return { added, deleted, path: pathParts.join('\t') }
    })
}

export function oversizedBinaryChanges(entries, sizeOf, maxBytes = MAX_BINARY_BYTES) {
  return entries
    .filter(({ added, deleted }) => added === '-' && deleted === '-')
    .map(({ path }) => ({ path, size: sizeOf(path) }))
    .filter(({ size }) => size > maxBytes)
}

function changedFiles(base, root) {
  const output = execFileSync(
    'git',
    ['diff', '--numstat', '-z', '--no-renames', '--diff-filter=AM', `${base}...HEAD`, '--'],
    { cwd: root, encoding: 'utf8' },
  )
  return parseNumstat(output)
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

export function run({ base, root = process.cwd() }) {
  const oversized = oversizedBinaryChanges(
    changedFiles(base, root),
    (path) => statSync(resolve(root, path)).size,
  )

  if (oversized.length === 0) {
    console.log(`No added or modified binary exceeds ${formatKiB(MAX_BINARY_BYTES)}.`)
    return 0
  }

  console.error(`Added or modified binaries must be ${formatKiB(MAX_BINARY_BYTES)} or smaller:`)
  for (const { path, size } of oversized) console.error(`  ${path} (${formatKiB(size)})`)
  console.error('Keep source assets in content-gen and publish website art through the approved assets.spacemolt.com workflow.')
  return 1
}

function parseArgs(argv) {
  const baseIndex = argv.indexOf('--base')
  if (baseIndex === -1 || !argv[baseIndex + 1]) {
    throw new Error('Usage: node scripts/check-binary-size.mjs --base <git-revision>')
  }
  return { base: argv[baseIndex + 1] }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = run(parseArgs(process.argv.slice(2)))
}
