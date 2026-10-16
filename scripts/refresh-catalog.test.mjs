import { expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { promisify } from 'node:util'

test('catalog version probe follows the production hostname redirect', async () => {
  const workflow = await readFile(new URL('../.github/workflows/refresh-catalog.yml', import.meta.url), 'utf8')
  const command = workflow.match(/DEPLOYED=\$\((curl [^\n]+?) \| jq/)[1]
  const server = createServer((request, response) => {
    if (request.url === '/api/catalog-version') {
      response.writeHead(307, { Location: '/canonical/api/catalog-version' })
      response.end('Redirecting...')
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ version: '0.630.0' }))
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const args = command.split(/\s+/).slice(1).map(arg =>
      arg.startsWith('https://') ? `http://127.0.0.1:${server.address().port}/api/catalog-version` : arg)
    const { stdout } = await promisify(execFile)('curl', args)
    expect(JSON.parse(stdout).version).toBe('0.630.0')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
