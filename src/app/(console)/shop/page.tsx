'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import type { ShopProduct } from '@/app/api/shop/products/route'
import styles from './page.module.css'

interface ShopResponse {
  products: ShopProduct[]
  shopUrl: string
  error?: string
}

function formatPrice(money: { value: number; currency: string } | null): string {
  if (!money) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currency,
    }).format(money.value)
  } catch {
    return `$${money.value.toFixed(2)}`
  }
}

// Strip the simple HTML Fourthwall stores in product descriptions down to text.
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function ProductCard({ product }: { product: ShopProduct }) {
  const { t } = useTranslation()
  const onSale =
    product.compareAtPrice &&
    product.price &&
    product.compareAtPrice.value > product.price.value

  return (
    <a
      className={`console-panel ${styles.card}`}
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className={styles.cardAccent} />
      <div className={styles.imageWrap}>
        {product.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.image}
              src={product.image}
              alt={product.name}
              loading="lazy"
            />
            {product.hoverImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                className={styles.imageHover}
                src={product.hoverImage}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
        {onSale && <span className={styles.saleBadge}>{t('shop.sale')}</span>}
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.productName}>{product.name}</h3>
        {product.descriptionHtml && (
          <p className={styles.productDesc}>{plainText(product.descriptionHtml)}</p>
        )}

        <div className={styles.metaRow}>
          {product.colors.length > 0 && (
            <span className={styles.swatches}>
              {product.colors.slice(0, 6).map((c) => (
                <span
                  key={c.name}
                  className={styles.swatch}
                  style={{ background: c.swatch }}
                  title={c.name}
                />
              ))}
              {product.colors.length > 6 && (
                <span className={styles.swatchMore}>+{product.colors.length - 6}</span>
              )}
            </span>
          )}
          {product.sizeCount > 1 && (
            <span className={styles.metaTag}>
              {t('shop.sizes', { count: String(product.sizeCount) })}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.price}>
          {product.variantCount > 1 && (
            <span className={styles.priceFrom}>{t('shop.from')} </span>
          )}
          {formatPrice(product.price)}
          {onSale && (
            <span className={styles.priceCompare}>{formatPrice(product.compareAtPrice)}</span>
          )}
        </span>
        <span className={styles.buyBtn}>
          {t('shop.view')}
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path
              d="M3 10L10 3M10 3H4.5M10 3V8.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </a>
  )
}

export default function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [shopUrl, setShopUrl] = useState('https://spacemolt-shop.fourthwall.com')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/shop/products')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ShopResponse = await res.json()
        if (!active) return
        setProducts(data.products || [])
        if (data.shopUrl) setShopUrl(data.shopUrl)
        if (data.error) setError(true)
      } catch {
        if (active) {
          setError(true)
          setProducts([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className={`console-page ${styles.main}`}>
      <header className="console-page-header">
        <span className="console-page-kicker">Supply</span>
        <h1 className="console-page-title">{t('shop.title')}</h1>
        <p className="console-page-sub">{t('shop.subtitle')}</p>
        <p className={styles.heroNote}>{t('shop.checkoutNote')}</p>
      </header>

      {loading && <div className={styles.loading}>{t('shop.loading')}</div>}

      {!loading && error && products.length === 0 && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>{t('shop.errorTitle')}</h3>
          <p>{t('shop.errorDesc')}</p>
          <a
            className={styles.emptyLink}
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('shop.visitStore')}
          </a>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>{t('shop.comingSoonTitle')}</h3>
          <p>{t('shop.comingSoonDesc')}</p>
        </div>
      )}

      {products.length > 0 && (
        <>
          <div className={styles.grid}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          <div className={styles.storeFooter}>
            <p className={styles.storeFooterText}>{t('shop.footerNote')}</p>
            <a
              className={styles.storeFooterLink}
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('shop.visitStore')}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path
                  d="M3 10L10 3M10 3H4.5M10 3V8.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
