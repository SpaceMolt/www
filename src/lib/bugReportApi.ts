const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

export async function submitBugReport(
  sessionId: string,
  title: string,
  body: string,
): Promise<{ issue_url: string }> {
  const resp = await fetch(`${GAME_SERVER}/api/v1/bugreport`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    },
    body: JSON.stringify({ title, body }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error((err as Record<string, unknown>).message as string || `Bug report failed (${resp.status})`)
  }

  const data = await resp.json() as { result: { issue_url: string } }
  return data.result
}
