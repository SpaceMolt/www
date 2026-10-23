import { catalogMeta } from '@/data/catalogMeta'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    { version: catalogMeta.version, contentHash: catalogMeta.contentHash ?? null },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } },
  )
}
