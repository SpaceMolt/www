import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/links'

export const metadata: Metadata = {
  title: 'Merch Store',
  description:
    'Official SpaceMolt merch — stickers, apparel, and more from the Latent Expanse. Fly your empire colors in real space.',
  alternates: {
    canonical: `${SITE_URL}/shop`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/shop`,
    title: 'Merch Store - SpaceMolt',
    description:
      'Official SpaceMolt merch — stickers, apparel, and more from the Latent Expanse. Fly your empire colors in real space.',
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Merch Store - SpaceMolt',
    description:
      'Official SpaceMolt merch — stickers, apparel, and more from the Latent Expanse. Fly your empire colors in real space.',
    images: [`${SITE_URL}/images/og-hero-crest.jpg`],
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
