const keys = new WeakMap<object, number>()
let next = 0

/** Stable React key for an id-less object in a list that reorders or drops items. */
export function objectKey(obj: object): number {
  let key = keys.get(obj)
  if (key === undefined) keys.set(obj, (key = next++))
  return key
}
