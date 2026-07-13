'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const KEY_PREFIX = 'sm-console-scroll:'
/** Frames to keep re-applying the restored offset while late content lands. */
const SETTLE_FRAMES = 12
/** Inputs that mean the visitor, not the framework, moved the scroller. */
const TAKEOVER_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const
/** Views with their own scrollport opt in by tagging it with a stable id. */
const SECONDARY_SELECTOR = '[data-scroll-restore]'

/**
 * Freeze hook for the currently mounted view, exposed to the handful of places
 * that navigate with router.push() instead of an anchor. Anchor clicks are
 * caught by the capture-phase listener below; a programmatic push raises no
 * click at all, so those call sites must announce the navigation themselves.
 */
let freezeActiveView: (() => void) | null = null

/**
 * Record the console's scroll position now and stop recording it.
 *
 * Call this immediately before a programmatic navigation (router.push). Without
 * it, the scroll events the router fires while tearing the page down look
 * exactly like the visitor scrolling to the top, and overwrite the saved offset.
 *
 * Covers every scroller the view owns, not just #console-main.
 */
export function saveConsoleScrollNow(): void {
  freezeActiveView?.()
}

interface Scroller {
  /** Bank the current offset and stop recording. Idempotent. */
  freeze: () => void
  /** Detach everything; writes a backstop offset unless already frozen. */
  dispose: () => void
}

/**
 * Remember and restore one scroll container's offset under one storage key.
 *
 * Everything here is per-element: the restore, the settle loop, the takeover
 * guard and the freeze latch. The navigation listeners that drive freeze() are
 * shared and live in the hook below, because they are per-view, not per-element.
 */
function trackScroller(el: HTMLElement, key: string): Scroller {
  // `key` is a parameter rather than something read from a ref: the caller
  // re-creates the scroller whenever it changes, so this closure always belongs
  // to the view it was created for. A ref would already hold the *incoming* key
  // by the time the outgoing view's cleanup runs, filing this view's offset
  // under the next view's name.
  const write = (value: number) => {
    try {
      sessionStorage.setItem(key, String(value))
    } catch {
      // sessionStorage unavailable (private mode, blocked storage)
    }
  }

  let target = 0
  try {
    const stored = sessionStorage.getItem(key)
    const parsed = stored === null ? NaN : parseInt(stored, 10)
    if (!Number.isNaN(parsed) && parsed > 0) target = parsed
  } catch {
    // sessionStorage unavailable
  }

  // The last offset the visitor actually scrolled to. Router navigation zeroes
  // the container *before* this effect is torn down, so el.scrollTop is already
  // 0 by cleanup time and cannot be trusted there — this is what gets persisted
  // instead. Seeded with the restore target so a view the visitor never touched
  // keeps its offset rather than being overwritten with 0.
  let lastUserTop = target

  // Once a navigation has begun, every further scroll event belongs to the
  // router unwinding this page, not to the visitor — the container gets zeroed
  // (or dragged through intermediate offsets) on the way out. Those events are
  // indistinguishable from real scrolling after the visitor has taken over, so
  // instead of trying to classify them the save path is shut off at the
  // navigation boundary and the true offset is banked there.
  let frozen = false

  let tookOver = false
  let settling = target > 0
  let settleFrame = 0
  let saveFrame = 0

  // Content below the fold usually arrives a frame or two late (fonts, images,
  // client-fetched lists), and the router's own scroll handling can snap the
  // container back to 0 after we land — so the offset is re-applied for a
  // handful of frames.
  if (settling) {
    el.scrollTop = target
    const settle = (frames: number) => {
      if (tookOver || frames >= SETTLE_FRAMES) {
        settling = false
        return
      }
      if (el.scrollTop < target && el.scrollHeight - el.clientHeight >= target) {
        el.scrollTop = target
      }
      settleFrame = requestAnimationFrame(() => settle(frames + 1))
    }
    settleFrame = requestAnimationFrame(() => settle(1))
  }

  // Restoring must never yank the visitor out of a position they chose, but a
  // scroll event alone cannot tell us who moved the scroller — our own settle
  // writes and the router's scroll-to-top raise one just like a wheel does.
  // Real input is what ends the settle, so a programmatic jump can't abort it
  // and a visitor scrolling on arrival is never fought.
  const onTakeover = () => {
    tookOver = true
    settling = false
  }

  // Throttled to one write per frame — scroll fires far faster than
  // sessionStorage wants to be written.
  const onScroll = () => {
    if (frozen || settling) return
    lastUserTop = el.scrollTop
    if (saveFrame) return
    saveFrame = requestAnimationFrame(() => {
      saveFrame = 0
      write(lastUserTop)
    })
  }

  // Bank the offset the visitor is leaving on, then stop listening. Reading
  // el.scrollTop here is safe in a way it is not at cleanup time: this runs at
  // the *start* of the navigation, before the router touches the container.
  // Mid-settle the container may not have reached the target yet, so the
  // pending target wins over what is currently on screen.
  const freeze = () => {
    if (frozen) return
    frozen = true
    if (saveFrame) {
      cancelAnimationFrame(saveFrame)
      saveFrame = 0
    }
    lastUserTop = settling ? lastUserTop : el.scrollTop
    write(lastUserTop)
  }

  el.addEventListener('scroll', onScroll, { passive: true })
  for (const type of TAKEOVER_EVENTS) {
    el.addEventListener(type, onTakeover, { passive: true })
  }

  const dispose = () => {
    el.removeEventListener('scroll', onScroll)
    for (const type of TAKEOVER_EVENTS) {
      el.removeEventListener(type, onTakeover)
    }
    if (saveFrame) cancelAnimationFrame(saveFrame)
    if (settleFrame) cancelAnimationFrame(settleFrame)
    // Backstop for teardowns no freeze saw (a scroller removed without a
    // navigation — a view toggle, say). A frozen scroller has already banked the
    // right value and must not be written again: el.scrollTop is 0 by now.
    if (!frozen) write(lastUserTop)
  }

  return { freeze, dispose }
}

/**
 * Remembers and restores the console's scroll position across navigations.
 *
 * The window never scrolls in the console — .shell is position:fixed and
 * #console-main is the overflow:auto container — so the browser's own scroll
 * restoration has nothing to restore and every back-navigation lands at the top.
 * This hook does the job on the element instead.
 *
 * Views that scroll *inside* the page (the ships table, whose wrapper scrolls so
 * its header can stay sticky) opt their scrollport in with a stable id:
 *
 *   <div className={styles.tableWrap} data-scroll-restore="ships-table">
 *
 * Each one is tracked independently, under the view's key suffixed with its id,
 * so the outer and inner offsets never overwrite each other. They mount and
 * unmount with the view, so the set is re-synced whenever the subtree changes.
 *
 * Keyed on pathname + query string on purpose: a differently-filtered or paged
 * list is a different view and must not inherit the previous view's offset.
 *
 * Callers must render this behind a <Suspense> boundary — useSearchParams()
 * otherwise opts every statically prerendered page out of prerendering.
 */
export function useScrollRestoration(elementId: string) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const key = `${KEY_PREFIX}${pathname}${search ? `?${search}` : ''}`

  useEffect(() => {
    const root = document.getElementById(elementId)
    if (!root) return

    const scrollers = new Map<Element, Scroller>()
    scrollers.set(root, trackScroller(root, key))

    // Secondary scrollports can appear after this effect runs (a view toggle, a
    // list that renders once its data is in) and disappear again, so the set is
    // rebuilt from the DOM rather than captured once. Dropping a scroller
    // disposes it, which is what keeps its listeners from outliving the element.
    const sync = () => {
      const present = new Set<Element>([root])
      for (const el of root.querySelectorAll<HTMLElement>(SECONDARY_SELECTOR)) {
        present.add(el)
        if (scrollers.has(el)) continue
        const id = el.dataset.scrollRestore
        if (!id) continue
        scrollers.set(el, trackScroller(el, `${key}#${id}`))
      }
      for (const [el, scroller] of scrollers) {
        if (present.has(el)) continue
        scroller.dispose()
        scrollers.delete(el)
      }
    }
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, { childList: true, subtree: true })

    // A navigation leaves every scroller of this view at once, so they freeze
    // together — the outer offset and the inner one are both part of "where the
    // visitor was".
    const freezeAll = () => {
      for (const scroller of scrollers.values()) scroller.freeze()
    }

    // Capture phase, on the document: this runs before React's onClick and so
    // before next/link hands the route to the router. Anything that lands on an
    // internal anchor is a navigation away from this view.
    const onDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== '_self')) return
      const url = new URL(anchor.href, location.href)
      if (url.origin !== location.origin) return
      // Same-view links (in-page hashes, a link back to where we already are)
      // navigate nowhere, so this effect would never be re-created to thaw.
      if (url.pathname + url.search === location.pathname + location.search) return
      freezeAll()
    }

    // Back / forward. The offsets saved here are the ones this view is leaving
    // on; the view being returned *to* gets its own fresh effect.
    const onPopState = () => freezeAll()

    document.addEventListener('click', onDocumentClick, true)
    window.addEventListener('popstate', onPopState)
    freezeActiveView = freezeAll

    return () => {
      observer.disconnect()
      document.removeEventListener('click', onDocumentClick, true)
      window.removeEventListener('popstate', onPopState)
      if (freezeActiveView === freezeAll) freezeActiveView = null
      for (const scroller of scrollers.values()) scroller.dispose()
      scrollers.clear()
    }
  }, [elementId, key])
}
