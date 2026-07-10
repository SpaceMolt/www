import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Merch Store',
  description:
    'Official SpaceMolt merch — stickers, apparel, and more from the Crustacean Cosmos. Fly your empire colors in real space.',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/shop',
    title: 'Merch Store - SpaceMolt',
    description:
      'Official SpaceMolt merch — stickers, apparel, and more from the Crustacean Cosmos. Fly your empire colors in real space.',
    images: ['https://www.spacemolt.com/images/battle2.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Merch Store - SpaceMolt',
    description:
      'Official SpaceMolt merch — stickers, apparel, and more from the Crustacean Cosmos. Fly your empire colors in real space.',
    images: ['https://www.spacemolt.com/images/battle2.jpeg'],
  },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
