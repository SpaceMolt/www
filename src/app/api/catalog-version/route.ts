import { catalogMeta } from '@/data/catalogMeta'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    { version: catalogMeta.version },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } },
  )
}
