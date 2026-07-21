import { NextResponse } from 'next/server'

// The merch catalog is served by Fourthwall's Storefront API. This route fetches
// it server-side so the (public, read-only) storefront token stays out of the
// client bundle and the response can be cached at the edge. See
// notes/marketing/merch-store.md for the store architecture.

// The storefront token is a public, read-only "ptkn_" token (Fourthwall's own
// tutorials embed it directly in client JS), but we still keep it out of the
// tracked source and read it from the environment. Set FOURTHWALL_STOREFRONT_TOKEN
// in Vercel (and .env.local for dev) — see .env.local.example.
const STOREFRONT_TOKEN = process.env.FOURTHWALL_STOREFRONT_TOKEN
const STOREFRONT_API = 'https://storefront-api.fourthwall.com/v1'
// Public hosted storefront — buy links hand off to Fourthwall's hosted checkout.
export const SHOP_BASE_URL =
  process.env.FOURTHWALL_SHOP_URL || 'https://spacemolt-shop.fourthwall.com'

// Fourthwall's public product pages live under a locale/currency segment
// (e.g. /en-usd/products/<slug>). Deep-linking to the bare /products/<slug>
// path lands on a gated route that prompts for sign-in, so buy links must
// include the locale. Overridable if the store's default locale changes.
export const SHOP_LOCALE = process.env.FOURTHWALL_SHOP_LOCALE || 'en-usd'

// Revalidate the catalog every 5 minutes.
export const revalidate = 300

interface FourthwallImage {
  url: string
  width?: number
  height?: number
}

interface FourthwallMoney {
  value: number
  currency: string
}

interface FourthwallVariant {
  id: string
  unitPrice?: FourthwallMoney
  compareAtPrice?: FourthwallMoney | null
  attributes?: {
    color?: { name: string; swatch?: string }
    size?: { name: string }
  }
}

interface FourthwallProduct {
  id: string
  name: string
  slug: string
  description?: string
  access?: { type: string }
  images?: FourthwallImage[]
  variants?: FourthwallVariant[]
}

export interface ShopProduct {
  id: string
  name: string
  slug: string
  descriptionHtml: string
  image: string | null
  hoverImage: string | null
  price: { value: number; currency: string } | null
  compareAtPrice: { value: number; currency: string } | null
  colors: { name: string; swatch: string }[]
  sizeCount: number
  variantCount: number
  url: string
}

function normalize(p: FourthwallProduct): ShopProduct {
  const variants = p.variants || []

  // Lowest variant price is the "from" price we advertise on the card.
  let price: FourthwallMoney | null = null
  let compareAtPrice: FourthwallMoney | null = null
  for (const v of variants) {
    if (v.unitPrice && (price === null || v.unitPrice.value < price.value)) {
      price = v.unitPrice
      compareAtPrice = v.compareAtPrice ?? null
    }
  }

  // Distinct colour swatches and size options across variants.
  const colorMap = new Map<string, string>()
  const sizes = new Set<string>()
  for (const v of variants) {
    const c = v.attributes?.color
    if (c?.name) colorMap.set(c.name, c.swatch || '#888888')
    const s = v.attributes?.size
    if (s?.name) sizes.add(s.name)
  }

  const images = p.images || []
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    descriptionHtml: p.description || '',
    image: images[0]?.url ?? null,
    hoverImage: images[1]?.url ?? null,
    price: price ? { value: price.value, currency: price.currency } : null,
    compareAtPrice: compareAtPrice
      ? { value: compareAtPrice.value, currency: compareAtPrice.currency }
      : null,
    colors: Array.from(colorMap, ([name, swatch]) => ({ name, swatch })),
    sizeCount: sizes.size,
    variantCount: variants.length,
    url: `${SHOP_BASE_URL}/${SHOP_LOCALE}/products/${p.slug}`,
  }
}

export async function GET() {
  if (!STOREFRONT_TOKEN) {
    // Not configured — surface a clean state rather than calling upstream with
    // an undefined token.
    return NextResponse.json({
      products: [],
      shopUrl: SHOP_BASE_URL,
      error: 'not configured',
    })
  }
  try {
    const products: FourthwallProduct[] = []
    // The "all" collection contains every public product. Page through it
    // (capped) so we never hang on a runaway paginator.
    for (let page = 0; page < 20; page++) {
      const res = await fetch(
        `${STOREFRONT_API}/collections/all/products?storefront_token=${STOREFRONT_TOKEN}&page=${page}`,
        { next: { revalidate } },
      )
      if (!res.ok) {
        if (page === 0) {
          return NextResponse.json(
            { products: [], shopUrl: SHOP_BASE_URL, error: `upstream ${res.status}` },
            { status: 502 },
          )
        }
        break
      }
      const data = await res.json()
      const batch: FourthwallProduct[] = data.results || []
      products.push(...batch)
      if (!data.paging?.hasNextPage) break
    }

    // Only surface publicly-accessible products; hidden/soft-gated items are
    // distributed by secret link, not listed here.
    const visible = products.filter((p) => (p.access?.type ?? 'PUBLIC') === 'PUBLIC')

    return NextResponse.json({
      products: visible.map(normalize),
      shopUrl: SHOP_BASE_URL,
    })
  } catch {
    return NextResponse.json(
      { products: [], shopUrl: SHOP_BASE_URL, error: 'fetch failed' },
      { status: 502 },
    )
  }
}
