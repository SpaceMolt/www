# Public Newsletter Signup (beehiiv embed) — Design

Date: 2026-06-03

## Goal

Add a public, anonymous email-subscription form to the SpaceMolt marketing site
(`www`) so visitors who are not logged in can subscribe to the SpaceMolt
newsletter. The form uses beehiiv's hosted embed (already styled in the beehiiv
dashboard to match the SpaceMolt dark/cyan/mono aesthetic).

This is distinct from the existing **authenticated** newsletter flow
(`NewsletterPrompt` / `NewsletterSettings` → gameserver `/api/newsletter` →
beehiiv), which is for logged-in pilots using their Clerk email. That flow is
left untouched.

## Decisions (confirmed with the dev team)

- **Integration:** beehiiv hosted embed (subscribe form), not a custom form/API
  route. The form is created and styled in the beehiiv dashboard.
- **Embed form ID:** `e66dd0da-f0a7-4fcb-86e6-3fb13c7aff70`
- **Fields:** email only (controlled by the beehiiv form).
- **Placements:** global footer (compact) + a dedicated homepage section + a
  bottom-of-page block on `/features`, `/clients`, `/about` only.
- **No backend, no DB:** pure client-side embed → beehiiv. No www API route is
  added and no email ever touches our database (consistent with the no-PII rule).

## Why the embed (not a custom API form)

`.env.production` contains `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID`, which
would support a custom themed form posting to a new www API route. However, the
dev team configured a beehiiv subscribe form in the dashboard and confirmed it
renders with the correct SpaceMolt fonts and colors. The embed therefore needs
no custom backend, no key handling, and stays the single source of styling.

## beehiiv v3 loader behavior (verified)

The embed snippet is:

```html
<script async src="https://subscribe-forms.beehiiv.com/v3/loader.js" data-beehiiv-form="e66dd0da-f0a7-4fcb-86e6-3fb13c7aff70"></script>
<script type="text/javascript" async src="https://subscribe-forms.beehiiv.com/attribution.js"></script>
```

Verified behavior of `loader.js` (v3 "embed controller"):

- It scans for `<script data-beehiiv-form="...">` tags and inserts the rendered
  form **adjacent to that tag** (`parentNode.insertBefore(wrap, script.nextSibling)`)
  for inline forms. So the form renders wherever its script tag lives.
- It **supports multiple forms per page** via a `window.__bhv_embeds` registry
  keyed by form ID, iterating all matching script tags.
- Each processed tag is marked `data-bhv-initialized="true"` to prevent
  re-processing.
- It creates an `<iframe>` that auto-resizes via `postMessage`.
- It does **not** guard against the loader *script src* being loaded twice (both
  copies run init), but the per-tag init guard makes that low-risk.

## Architecture

### Component: `src/components/NewsletterSignup.tsx` (client component)

A single reusable client component renders a container `<div>` and, on mount,
appends the beehiiv loader script (with the `data-beehiiv-form` attribute) **into
that container ref**. Because the loader inserts the form adjacent to its own
script tag, the form renders in place inside the container.

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useTranslation } from '@/i18n'
import styles from './NewsletterSignup.module.css'

const BEEHIIV_FORM_ID = 'e66dd0da-f0a7-4fcb-86e6-3fb13c7aff70'

type Variant = 'compact' | 'section'

export function NewsletterSignup({ variant = 'section' }: { variant?: Variant }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    // Avoid stacking duplicate scripts if the effect re-runs.
    if (host.querySelector('script[data-beehiiv-form]')) return
    const s = document.createElement('script')
    s.src = 'https://subscribe-forms.beehiiv.com/v3/loader.js'
    s.async = true
    s.setAttribute('data-beehiiv-form', BEEHIIV_FORM_ID)
    host.appendChild(s)
  }, [])

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        <span className={styles.compactLabel}>{t('newsletter.footerLabel')}</span>
        <div ref={ref} className={styles.embedHost} />
      </div>
    )
  }

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionInner}>
          <h2 className={styles.title}>{t('newsletter.title')}</h2>
          <p className={styles.subtitle}>{t('newsletter.subtitle')}</p>
          <div ref={ref} className={styles.embedHost} />
        </div>
      </div>
    </section>
  )
}
```

Rationale for re-appending the loader per component mount (rather than a single
global script): it makes the form reliable across Next.js client-side navigation
(each mount re-runs and re-scans), the loader is browser-cached after the first
fetch, and the per-tag `data-bhv-initialized` guard prevents duplicate forms.

### `attribution.js` (load once, globally)

Added once in `src/app/layout.tsx` via `next/script` with
`strategy="afterInteractive"`, so UTM/referrer attribution works without being
duplicated per placement.

### Styling: `src/components/NewsletterSignup.module.css`

- `.embedHost` — minimal wrapper; the beehiiv iframe carries its own styling.
  Constrain max-width and center it so the embed doesn't stretch awkwardly in
  wide sections.
- `.section` — section padding consistent with neighboring homepage sections
  (reference `home.module.css` patreon/discord section spacing).
- `.compact` / `.compactLabel` — footer treatment: small mono label above a
  width-constrained embed, fitting the existing footer columns.

No emoji; if any decorative icon is wanted, use a lucide icon (e.g. `Mail`),
consistent with the SpaceMolt UI rules.

### Placements

1. **Footer** — `src/components/Footer.tsx`: add a newsletter element rendering
   `<NewsletterSignup variant="compact" />`. Placed either as a new column in
   `footer-top` or a full-width row above `footer-bottom`; choose whichever keeps
   the footer grid balanced (decided during implementation by eye).
2. **Homepage** — `src/app/HomeContent.tsx`: insert `<NewsletterSignup variant="section" />`
   **between the Patreon section and the Discord section**.
3. **Marketing-page bottoms** — render `<NewsletterSignup variant="section" />`
   just above the footer on `/features`, `/clients`, `/about` only. (The footer
   already covers every page, so limiting the block to these three high-intent
   pages avoids the signup appearing twice on most pages.)

### Copy + i18n

New translation keys under `newsletter.*` added to the i18n translation files
(matching the structure used by existing sections):

- `newsletter.title` — e.g. "Get SpaceMolt transmissions"
- `newsletter.subtitle` — e.g. "Patch notes, dev updates, and dispatches from the
  galaxy. No spam. Lobster promise."
- `newsletter.footerLabel` — e.g. "Newsletter"

Exact wording finalized during implementation; the form's field placeholder and
button label are controlled in the beehiiv dashboard.

## Out of scope

- No changes to the authenticated dashboard newsletter flow.
- No www API route, no server code, no DB writes.
- No analytics beyond beehiiv's own `attribution.js`.

## Testing / verification

beehiiv is a third-party iframe, so automated assertions are limited. Verify by:

1. Run www locally and load the homepage — confirm the section renders the embed
   between Patreon and Discord, and the footer shows the compact embed.
2. Load `/features`, `/clients`, `/about` — confirm the bottom block renders.
3. Confirm a page that has both footer + section (homepage) shows **two** working
   forms (loader multi-instance support).
4. Client-side navigate between pages and confirm the embed still renders (no
   blank host) after navigation.
5. Submit a test email and confirm it lands in beehiiv.
6. Confirm no console errors and `attribution.js` loads once.
```
