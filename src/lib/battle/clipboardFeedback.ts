export type ClipboardStatus = 'idle' | 'copying' | 'copied' | 'failed'

/** A missing API or denied write must never look like a successful copy. */
export async function writeClipboardText(
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
  text: string,
): Promise<boolean> {
  if (!clipboard) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Owns one control's pending write and feedback timer, including teardown. */
export function createClipboardFeedback(copy: () => Promise<boolean>, onStatus: (status: ClipboardStatus) => void) {
  let disposed = false
  let pending = false
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    async copy() {
      if (disposed || pending) return
      if (timer !== undefined) clearTimeout(timer)
      pending = true
      onStatus('copying')
      let success = false
      try {
        success = await copy()
      } catch {
        // Treat unexpected callback errors just like a rejected clipboard write.
      }
      if (disposed) return
      pending = false
      onStatus(success ? 'copied' : 'failed')
      if (success) timer = setTimeout(() => { if (!disposed) onStatus('idle') }, 1500)
    },
    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
