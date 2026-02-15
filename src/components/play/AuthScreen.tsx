'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import {
  LogIn,
  UserPlus,
  User,
  KeyRound,
  Shield,
  ChevronRight,
  AlertTriangle,
  Copy,
  Check,
  Rocket,
  Ticket,
} from 'lucide-react'
import { useGame } from './GameProvider'
import styles from './AuthScreen.module.css'

interface AuthScreenProps {
  registrationCode?: string
  onRegistered: (username: string, password: string) => void
  onLoggedIn: () => void
}

interface EmpireInfo {
  id: string
  name: string
  description: string
  color: string
}

const EMPIRES: EmpireInfo[] = [
  { id: 'solarian', name: 'Solarian Confederacy', description: 'Mining and trading bonuses', color: '#4A90D9' },
  { id: 'voidborn', name: 'Voidborn Collective', description: 'Stealth and shield bonuses', color: '#00FFFF' },
  { id: 'crimson', name: 'Crimson Pact', description: 'Combat damage bonuses', color: '#DC143C' },
  { id: 'nebula', name: 'Nebula Trade Federation', description: 'Exploration speed bonuses', color: '#FFD700' },
  { id: 'outerrim', name: 'Outer Rim Explorers', description: 'Crafting and cargo bonuses', color: '#4169E1' },
]

export function AuthScreen({ registrationCode: registrationCodeProp, onRegistered, onLoggedIn }: AuthScreenProps) {
  const { state, sendCommand } = useGame()

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [empire, setEmpire] = useState('')
  const [registrationCode, setRegistrationCode] = useState(registrationCodeProp || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registeredPassword, setRegisteredPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Track the last-seen event log length to detect new entries
  const lastEventCountRef = useRef(state.eventLog.length)
  const pendingRegisterRef = useRef(false)
  const usernameRef = useRef(username)
  usernameRef.current = username

  // Listen for the 'spacemolt:registered' custom event dispatched by GameProvider.
  // This event carries the password in its detail field.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ password: string }>).detail
      if (!detail?.password) return

      const pw = detail.password
      setRegisteredPassword(pw)
      setLoading(false)
      setError(null)
      pendingRegisterRef.current = false

      onRegistered(usernameRef.current, pw)
    }

    document.addEventListener('spacemolt:registered', handler)
    return () => document.removeEventListener('spacemolt:registered', handler)
  }, [onRegistered])

  // Fallback: detect registration success from event log if the custom event
  // was not dispatched (e.g., GameProvider does not yet emit it).
  useEffect(() => {
    if (state.eventLog.length <= lastEventCountRef.current) {
      lastEventCountRef.current = state.eventLog.length
      return
    }
    lastEventCountRef.current = state.eventLog.length

    const latest = state.eventLog[0]
    if (!latest || !loading) return

    // Detect errors
    if (latest.type === 'error') {
      setError(latest.message)
      setLoading(false)
      pendingRegisterRef.current = false
      return
    }

    // Detect registration success via event log message
    if (
      pendingRegisterRef.current &&
      latest.type === 'system' &&
      latest.message.includes('Registration successful') &&
      !registeredPassword
    ) {
      // Registration succeeded but we don't have the password from the event.
      // The password should arrive via the 'spacemolt:registered' custom event.
      // If it hasn't arrived yet, we wait briefly, then fall back.
      setTimeout(() => {
        if (!pendingRegisterRef.current) return // already handled by custom event
        // Fallback: registration succeeded but password was not captured.
        // This means the GameProvider does not yet dispatch the custom event.
        // Signal success without the password -- the parent can handle this.
        setLoading(false)
        pendingRegisterRef.current = false
        setRegisteredPassword('(check server response)')
        onRegistered(usernameRef.current, '')
      }, 200)
    }
  }, [state.eventLog, loading, registeredPassword, onRegistered])

  // Watch for successful login
  useEffect(() => {
    if (state.authenticated && loading && !pendingRegisterRef.current) {
      setLoading(false)
      setError(null)
      onLoggedIn()
    }
  }, [state.authenticated, loading, onLoggedIn])

  // Clear error when switching tabs
  useEffect(() => {
    setError(null)
    setLoading(false)
    setRegisteredPassword(null)
    pendingRegisterRef.current = false
  }, [activeTab])

  const handleLogin = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!username.trim() || !password.trim()) {
        setError('Username and password are required.')
        return
      }
      setError(null)
      setLoading(true)
      sendCommand('login', { username: username.trim(), password: password.trim() })
    },
    [username, password, sendCommand],
  )

  const handleRegister = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!username.trim()) {
        setError('Username is required.')
        return
      }
      if (!empire) {
        setError('Please select an empire.')
        return
      }
      setError(null)
      setLoading(true)
      pendingRegisterRef.current = true
      const payload: Record<string, unknown> = {
        username: username.trim(),
        empire,
      }
      if (registrationCode.trim()) {
        payload.registration_code = registrationCode.trim()
      }
      sendCommand('register', payload)
    },
    [username, empire, registrationCode, sendCommand],
  )

  const handleCopyPassword = useCallback(async () => {
    if (!registeredPassword) return
    try {
      await navigator.clipboard.writeText(`Username: ${username}\nPassword: ${registeredPassword}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available
    }
  }, [username, registeredPassword])

  // Registration success screen
  if (registeredPassword) {
    return (
      <div className={styles.backdrop}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>SpaceMolt</h1>
            <p className={styles.subtitle}>REGISTRATION COMPLETE</p>
          </div>

          <div className={styles.success}>
            <div className={styles.successHeader}>
              <span className={styles.successIcon}>
                <Check size={16} />
              </span>
              <span className={styles.successTitle}>Account Created</span>
            </div>

            <div className={styles.warningText}>
              <span className={styles.warningIcon}>
                <AlertTriangle size={14} />
              </span>
              <span>
                Write down your credentials now. The password cannot be recovered.
                If lost, visit spacemolt.com/dashboard to reset.
              </span>
            </div>

            <div className={styles.credentialsBox}>
              <div className={styles.credentialRow}>
                <span className={styles.credentialLabel}>Username</span>
                <span className={styles.credentialValue}>{username}</span>
              </div>
              <div className={styles.credentialRow}>
                <span className={styles.credentialLabel}>Password</span>
                <span className={styles.credentialValue}>{registeredPassword}</span>
              </div>
              <button
                className={styles.copyBtn}
                onClick={handleCopyPassword}
                title="Copy credentials"
                type="button"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy credentials'}
              </button>
            </div>

            <button
              className={styles.continueBtn}
              onClick={onLoggedIn}
              type="button"
            >
              <Rocket size={14} />
              Launch into Space
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>SpaceMolt</h1>
          <p className={styles.subtitle}>AUTHENTICATE TO PLAY</p>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'login' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('login')}
            type="button"
          >
            <span className={styles.tabIcon}><LogIn size={14} /></span>
            Login
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'register' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('register')}
            type="button"
          >
            <span className={styles.tabIcon}><UserPlus size={14} /></span>
            Register
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>
              <AlertTriangle size={14} />
            </span>
            <span className={styles.errorText}>{error}</span>
          </div>
        )}

        {/* Login form */}
        {activeTab === 'login' && (
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-username">
                <span className={styles.labelIcon}><User size={12} /></span>
                Username
              </label>
              <input
                id="login-username"
                className={styles.input}
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                <span className={styles.labelIcon}><KeyRound size={12} /></span>
                Password
              </label>
              <input
                id="login-password"
                className={styles.input}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={loading || !state.connected}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <span className={styles.submitBtnIcon}><LogIn size={14} /></span>
                  Connect
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Register form */}
        {activeTab === 'register' && (
          <form className={styles.form} onSubmit={handleRegister}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-username">
                <span className={styles.labelIcon}><User size={12} /></span>
                Username
              </label>
              <input
                id="reg-username"
                className={styles.input}
                type="text"
                placeholder="Choose a unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                <span className={styles.labelIcon}><Shield size={12} /></span>
                Empire
              </label>
              <div className={styles.empireGrid}>
                {EMPIRES.slice(0, 4).map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className={`${styles.empireOption} ${empire === emp.id ? styles.empireOptionSelected : ''}`}
                    onClick={() => setEmpire(emp.id)}
                    disabled={loading}
                    style={
                      empire === emp.id
                        ? { borderColor: emp.color, boxShadow: `0 0 12px ${emp.color}33` }
                        : undefined
                    }
                  >
                    <span
                      className={styles.empireDot}
                      style={{ backgroundColor: emp.color, color: emp.color }}
                    />
                    <span className={styles.empireName}>{emp.name}</span>
                    <span className={styles.empireBonus}>{emp.description}</span>
                  </button>
                ))}
                <div className={styles.empireGridLastRow}>
                  {EMPIRES.slice(4).map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      className={`${styles.empireOption} ${empire === emp.id ? styles.empireOptionSelected : ''}`}
                      onClick={() => setEmpire(emp.id)}
                      disabled={loading}
                      style={
                        empire === emp.id
                          ? { borderColor: emp.color, boxShadow: `0 0 12px ${emp.color}33` }
                          : undefined
                      }
                    >
                      <span
                        className={styles.empireDot}
                        style={{ backgroundColor: emp.color, color: emp.color }}
                      />
                      <span className={styles.empireName}>{emp.name}</span>
                      <span className={styles.empireBonus}>{emp.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="reg-code">
                <span className={styles.labelIcon}><Ticket size={12} /></span>
                Registration Code
              </label>
              <input
                id="reg-code"
                className={styles.input}
                type="text"
                placeholder="Enter code (if you have one)"
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value)}
                autoComplete="off"
                disabled={loading}
                readOnly={!!registrationCodeProp}
              />
            </div>

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={loading || !state.connected}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <span className={styles.submitBtnIcon}><UserPlus size={14} /></span>
                  Create Account
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
