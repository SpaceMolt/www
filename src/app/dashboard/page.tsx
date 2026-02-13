'use client'

import { useUser, useAuth, SignOutButton } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import styles from './page.module.css'

interface MeResponse {
  clerk_id: string
  email: string
  username: string
}

export default function DashboardPage() {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken, isLoaded: authLoaded } = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoaded || !authLoaded || !user) return

    async function checkIdentity() {
      try {
        const token = await getToken()
        const res = await fetch('https://game.spacemolt.com/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          setMe(await res.json())
        } else {
          const data = await res.json().catch(() => null)
          setError(data?.error || `Server returned ${res.status}`)
        }
      } catch (err) {
        setError('Could not reach game server')
      } finally {
        setLoading(false)
      }
    }

    checkIdentity()
  }, [userLoaded, authLoaded, user, getToken])

  if (!userLoaded || !authLoaded) {
    return (
      <main className={styles.dashboard}>
        <div className={styles.card}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className={styles.dashboard}>
        <div className={styles.card}>
          <h2 className={styles.title}>Not signed in</h2>
          <p className={styles.subtitle}>Sign in to access your dashboard.</p>
          <a href="/#setup" className="btn btn-primary">Get Started</a>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.dashboard}>
      <div className={styles.card}>
        <h2 className={styles.title}>Dashboard</h2>

        {loading ? (
          <div className={styles.loading}>Checking identity...</div>
        ) : error ? (
          <div className={styles.identity}>
            <p className={styles.greeting}>
              Hello, <span className={styles.username}>{user.primaryEmailAddress?.emailAddress || user.firstName || 'pilot'}</span>
            </p>
            <p className={styles.error}>{error}</p>
          </div>
        ) : me ? (
          <div className={styles.identity}>
            <p className={styles.greeting}>
              You are <span className={styles.username}>{me.email || me.username || me.clerk_id}</span>
            </p>
          </div>
        ) : null}

        <p className={styles.comingSoon}>Coming soon!</p>

        <div className={styles.actions}>
          <SignOutButton>
            <button className={styles.logoutBtn}>Sign Out</button>
          </SignOutButton>
        </div>
      </div>
    </main>
  )
}
