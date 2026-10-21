import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { battleListParams } from './listFilters'

// Execute the real page with controlled hooks and timers, without a DOM dependency.
function pageHarness() {
  const slots: any[] = []
  const effects: (() => void)[] = []
  const timers = new Set<() => void>()
  const calls: URL[] = []
  let cursor = 0, dirty = false, tree: any, poll: () => void
  const memo = (fn: () => any, deps: any[]) => {
    const i = cursor++
    if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i].deps[j]))) {
      slots[i] = { value: fn(), deps }
    }
    return slots[i].value
  }
  const hooks = {
    useState(initial: any) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], (value: any) => { if (!Object.is(slots[i], value)) { slots[i] = value; dirty = true } }]
    },
    useRef: (value: any) => memo(() => ({ current: value }), []),
    useMemo: memo,
    useCallback: (fn: any, deps: any[]) => memo(() => fn, deps),
    useEffect(fn: () => any, deps: any[]) {
      const i = cursor++
      if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i].deps[j]))) {
        const old = slots[i]
        slots[i] = { deps }
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn() })
      }
    },
  }
  let callbacks: any
  const request = { run: (url: string) => { calls.push(new URL(url)); callbacks.success({ battles: [], total: 100, has_more: true }); callbacks.settled() }, cancel() {} }
  const source = readFileSync(new URL('../../app/(console)/battles/page.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports: any = {}
  runInNewContext(outputText, {
    exports, process: { env: {} }, document: {},
    setTimeout: (fn: () => void) => { timers.add(fn); return fn },
    clearTimeout: (fn: () => void) => timers.delete(fn),
    require: (id: string) => {
      if (id === 'react') return hooks
      if (id === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) }
      if (id === '@/i18n') return { useTranslation: () => ({ t: (key: string) => key }) }
      if (id === '@/lib/useVisiblePoll') return { useVisiblePoll: (fn: () => void) => { poll = fn } }
      if (id === '@/lib/battle/listRequest') return { createListRequest: (value: any) => { callbacks = value; return request } }
      if (id === '@/lib/battle/listFilters') return { battleListParams }
      return { default: {} }
    },
  })
  const render = () => { do { dirty = false; cursor = 0; tree = exports.default(); effects.splice(0).forEach(fn => fn()) } while (dirty) }
  const find = (predicate: (node: any) => boolean, node = tree): any => {
    if (!node || typeof node !== 'object') return
    if (predicate(node)) return node
    for (const child of [node.props?.children].flat(Infinity)) { if (!child) continue; const found = find(predicate, child); if (found) return found }
  }
  render()
  return {
    calls, find,
    click(label: string) { find(n => n.type === 'button' && [n.props.children].flat().includes(label)).props.onClick(); render() },
    type(value: string) { find(n => n.type === 'input').props.onChange({ target: { value } }); render() },
    wait() { const pending = [...timers]; timers.clear(); pending.forEach(fn => fn()); render() },
    submit() { const form = find(n => n.type === 'form'); expect(form).toBeDefined(); let prevented = false; form.props.onSubmit({ preventDefault() { prevented = true } }); expect(prevented).toBe(true); render() },
    poll() { poll(); render() },
  }
}

test('battle search waits for submission, and polling keeps the submitted query', () => {
  const h = pageHarness()
  expect(h.calls).toHaveLength(1)
  h.type('V'); h.wait()
  h.type('  Vex  '); h.wait()
  expect(h.calls).toHaveLength(1)
  h.submit()
  expect(h.calls.at(-1)?.searchParams.get('search')).toBe('Vex')
  h.type('Vex Caldera'); h.wait(); h.poll()
  expect(h.calls.at(-1)?.searchParams.get('search')).toBe('Vex')
  h.click('battles.loadMore')
  expect(h.calls.at(-1)?.searchParams.get('search')).toBe('Vex')
  expect(h.calls.at(-1)?.searchParams.get('limit')).toBe('100')
  h.click('battles.filterCompleted')
  expect(h.calls.at(-1)?.searchParams.get('search')).toBe('Vex')
  expect(h.calls.at(-1)?.searchParams.get('status')).toBe('completed')
  h.submit()
  expect(h.calls.at(-1)?.searchParams.get('search')).toBe('Vex Caldera')
  const count = h.calls.length
  h.submit()
  expect(h.calls).toHaveLength(count)
  h.type(''); h.submit()
  expect(h.calls.at(-1)?.searchParams.has('search')).toBe(false)
  expect(h.find(n => n.type === 'button' && n.props.type === 'submit')).toBeDefined()
})
