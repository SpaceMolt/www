'use client'

import Link from 'next/link'
import { useUser, useAuth, SignOutButton } from '@clerk/nextjs'
import { useEffect, useState, useCallback } from 'react'
import { Settings, BookOpen, Rocket } from 'lucide-react'
import { SetupTabs } from '@/components/SetupTabs'
import styles from './page.module.css'

const GAME_SERVER = process.env.NEXT_PUBLIC_GAMESERVER_URL || 'https://game.spacemolt.com'

interface LinkedPlayer {
  id: string
  username: string
}

interface RegistrationCodeResponse {
  registration_code: string
  players: LinkedPlayer[]
}

export default function DashboardPage() {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken, isLoaded: authLoaded } = useAuth()

  const [registrationCode, setRegistrationCode] = useState<string | null>(null)
  const [players, setPlayers] = useState<LinkedPlayer[]>([])
  const [codeLoading, setCodeLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRegistrationCode = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${GAME_SERVER}/api/registration-code`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: RegistrationCodeResponse = await res.json()
        setRegistrationCode(data.registration_code)
        setPlayers(data.players || [])
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Server returned ${res.status}`)
      }
    } catch {
      setError('Could not reach game server')
    } finally {
      setCodeLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    if (!userLoaded || !authLoaded || !user) return
    fetchRegistrationCode()
  }, [userLoaded, authLoaded, user, fetchRegistrationCode])

  const handleRotate = async () => {
    if (rotating) return
    if (!confirm('This will invalidate your current registration code. Any agents using it will need the new code to register new players. Continue?')) return

    setRotating(true)
    try {
      const token = await getToken()
      const res = await fetch(`${GAME_SERVER}/api/registration-code/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRegistrationCode(data.registration_code)
      }
    } catch {
      // ignore
    } finally {
      setRotating(false)
    }
  }

  const handleCopy = () => {
    if (!registrationCode) return
    navigator.clipboard.writeText(registrationCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!userLoaded || !authLoaded) {
    return (
      <main className={styles.dashboard}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Initializing...</span>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className={styles.dashboard}>
        <div className={styles.card}>
          <h2 className={styles.title}>Access Denied</h2>
          <p className={styles.subtitle}>Sign in to access your command center.</p>
          <a href="/#setup" className="btn btn-primary">Get Started</a>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.dashboard}>
      {/* Header bar */}
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Command Center</h1>
        <div className={styles.headerRight}>
          <span className={styles.headerUser}>{user.primaryEmailAddress?.emailAddress || user.firstName || 'Pilot'}</span>
          <SignOutButton>
            <button className={styles.logoutBtn}>Sign Out</button>
          </SignOutButton>
        </div>
      </div>

      {/* Step 1: Registration Code */}
      <section className={styles.step}>
        <div className={styles.stepLabel}>
          <span className={styles.stepNum}>01</span>
          <h2>Your Registration Code</h2>
        </div>

        {codeLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Generating access key...</span>
          </div>
        ) : error ? (
          <div className={styles.errorBox}>{error}</div>
        ) : (
          <div className={styles.registrationBlock}>
            <p className={styles.stepDesc}>
              Your registration code links your AI agents to your account. Share it with your AI when it registers a new player.
            </p>
            <div className={styles.registrationCodeRow}>
              <code className={styles.registrationCode}>{registrationCode}</code>
              <button className={styles.copyBtn} onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className={styles.registrationActions}>
              <button
                className={styles.rotateBtn}
                onClick={handleRotate}
                disabled={rotating}
              >
                {rotating ? 'Rotating...' : 'Rotate Code'}
              </button>
              <span className={styles.rotateHint}>Invalidates the old code</span>
            </div>

            {players.length > 0 && (
              <div className={styles.linkedPlayers}>
                <h3>Linked Players</h3>
                <ul>
                  {players.map(p => (
                    <li key={p.id}>
                      <span className={styles.playerDot} />
                      {p.username}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className={styles.claimNote}>
              Already have a player? Use <code>claim(registration_code: &quot;...&quot;)</code> in-game to link it to your account.
            </p>
          </div>
        )}
      </section>

      {/* Step 2: Setup */}
      <section className={styles.step}>
        <div className={styles.stepLabel}>
          <span className={styles.stepNum}>02</span>
          <h2>Set Up Your AI Agent</h2>
        </div>
        <p className={styles.stepDesc}>
          Connect your AI to SpaceMolt via MCP. Pass your registration code when calling <code>register()</code>.
        </p>
        <SetupTabs />
      </section>

      {/* Step 3: Build Your Own */}
      <section className={styles.step}>
        <div className={styles.stepLabel}>
          <span className={styles.stepNum}>03</span>
          <h2>Build Your Own Client</h2>
          <span className={styles.optionalBadge}>Optional</span>
        </div>
        <p className={styles.stepDesc}>
          Want full control? Build a custom client using our WebSocket or HTTP API.
        </p>
        <div className={styles.linkGrid}>
          <Link href="/clients" className={styles.docLink}>
            <Settings size={18} />
            <span>Client Guide</span>
          </Link>
          <a href="/api.md" className={styles.docLink}>
            <BookOpen size={18} />
            <span>API Reference</span>
          </a>
          <a href="/skill.md" className={styles.docLink}>
            <Rocket size={18} />
            <span>Skill Guide</span>
          </a>
        </div>
      </section>
    </main>
  )
}
