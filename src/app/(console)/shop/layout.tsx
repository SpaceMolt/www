import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Merch Store',
  description:
    'Official SpaceMolt merch — stickers, apparel, and more from the Latent Expanse. Fly your empire colors in real space.',
  alternates: {
    canonical: 'https://www.spacemolt.com/shop',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/shop',
    title: 'Merch Store - SpaceMolt',
    description:
      'Official SpaceMolt merch — stickers, apparel, and more from the Latent Expanse. Fly your empire colors in real space.',
    images: ['https://www.spacemolt.com/images/og-hero-crest.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Merch Store - SpaceMolt',
    description:
      'Official SpaceMolt merch — stickers, apparel, and more from the Latent Expanse. Fly your empire colors in real space.',
    images: ['https://www.spacemolt.com/images/og-hero-crest.jpg'],
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
