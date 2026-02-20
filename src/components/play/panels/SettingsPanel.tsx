'use client'

import { useState, useCallback } from 'react'
import { Settings, Palette, Eye, EyeOff, Home, LogOut } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import styles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const { state, sendCommand } = useGame()
  const player = state.player

  const [statusMsg, setStatusMsg] = useState(player?.status_message ?? '')
  const [clanTag, setClanTag] = useState(player?.clan_tag ?? '')
  const [primaryColor, setPrimaryColor] = useState(player?.primary_color ?? '#00d4ff')
  const [secondaryColor, setSecondaryColor] = useState(player?.secondary_color ?? '#ff6b35')
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingTag, setSavingTag] = useState(false)
  const [savingColors, setSavingColors] = useState(false)
  const [settingHome, setSettingHome] = useState(false)

  const isAnonymous = player?.is_anonymous ?? false
  const isDocked = state.isDocked

  const handleSaveStatus = useCallback(() => {
    setSavingStatus(true)
    sendCommand('set_status', { status_message: statusMsg })
    setTimeout(() => setSavingStatus(false), 2000)
  }, [sendCommand, statusMsg])

  const handleSaveTag = useCallback(() => {
    setSavingTag(true)
    sendCommand('set_status', { clan_tag: clanTag.toUpperCase() })
    setTimeout(() => setSavingTag(false), 2000)
  }, [sendCommand, clanTag])

  const handleSaveColors = useCallback(() => {
    setSavingColors(true)
    sendCommand('set_colors', {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    })
    setTimeout(() => setSavingColors(false), 2000)
  }, [sendCommand, primaryColor, secondaryColor])

  const handleToggleAnonymous = useCallback(() => {
    sendCommand('set_anonymous', { anonymous: !isAnonymous })
  }, [sendCommand, isAnonymous])

  const handleSetHomeBase = useCallback(() => {
    setSettingHome(true)
    sendCommand('set_home_base')
    setTimeout(() => setSettingHome(false), 2000)
  }, [sendCommand])

  const handleLogout = useCallback(() => {
    sendCommand('logout')
    try {
      localStorage.removeItem('spacemolt_token')
    } catch {
      // localStorage may not be available
    }
  }, [sendCommand])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}><Settings size={16} /></span>
          Settings
        </div>
      </div>

      <div className={styles.content}>
        {/* Status Message */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Settings size={12} /></span>
            Status Message
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <input
                className={styles.input}
                type="text"
                placeholder="Set your status..."
                value={statusMsg}
                onChange={(e) => setStatusMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveStatus()}
              />
            </div>
            <ActionButton
              label="Save"
              onClick={handleSaveStatus}
              disabled={savingStatus}
              loading={savingStatus}
              size="sm"
            />
          </div>
        </div>

        <div className={styles.divider} />

        {/* Clan Tag */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Settings size={12} /></span>
            Clan Tag
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <input
                className={styles.input}
                type="text"
                placeholder="ABCD"
                maxLength={4}
                value={clanTag}
                onChange={(e) => setClanTag(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTag()}
              />
            </div>
            <ActionButton
              label="Save"
              onClick={handleSaveTag}
              disabled={savingTag}
              loading={savingTag}
              size="sm"
            />
          </div>
        </div>

        <div className={styles.divider} />

        {/* Colors */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Palette size={12} /></span>
            Ship Colors
          </div>
          <div className={styles.colorSection}>
            <div className={styles.colorField}>
              <label className={styles.label}>Primary</label>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  className={styles.colorPicker}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <span className={styles.colorHex}>{primaryColor}</span>
              </div>
            </div>
            <div className={styles.colorField}>
              <label className={styles.label}>Secondary</label>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  className={styles.colorPicker}
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                />
                <span className={styles.colorHex}>{secondaryColor}</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <ActionButton
              label="Save Colors"
              icon={<Palette size={12} />}
              onClick={handleSaveColors}
              disabled={savingColors}
              loading={savingColors}
              size="sm"
            />
          </div>
        </div>

        <div className={styles.divider} />

        {/* Anonymous Toggle */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              {isAnonymous ? <EyeOff size={12} /> : <Eye size={12} />}
            </span>
            Visibility
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>
                <span className={styles.toggleIcon}>
                  {isAnonymous ? <EyeOff size={14} /> : <Eye size={14} />}
                </span>
                Anonymous Mode
              </span>
              <span className={styles.toggleDesc}>
                {isAnonymous
                  ? 'Your identity is hidden from other players'
                  : 'Other players can see your name and info'}
              </span>
            </div>
            <button
              type="button"
              className={`${styles.toggleSwitch} ${isAnonymous ? styles.toggleSwitchOn : ''}`}
              onClick={handleToggleAnonymous}
              aria-label="Toggle anonymous mode"
            />
          </div>
        </div>

        <div className={styles.divider} />

        {/* Set Home Base */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Home size={12} /></span>
            Home Base
          </div>
          <ActionButton
            label="Set Current Base as Home"
            icon={<Home size={14} />}
            onClick={handleSetHomeBase}
            disabled={!isDocked || settingHome}
            loading={settingHome}
            variant="secondary"
            size="sm"
          />
        </div>

        <div className={styles.divider} />

        {/* Connection Info */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Settings size={12} /></span>
            Connection
          </div>
          <div className={styles.connectionCard}>
            <div className={styles.connectionRow}>
              <span className={styles.connectionLabel}>Status</span>
              <span className={
                state.connected
                  ? styles.connectionValueOnline
                  : styles.connectionValueOffline
              }>
                <span className={`${styles.statusDot} ${
                  state.connected ? styles.statusDotOnline : styles.statusDotOffline
                }`} />
                {state.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className={styles.connectionRow}>
              <span className={styles.connectionLabel}>Tick</span>
              <span className={styles.connectionValue}>
                {state.currentTick}
              </span>
            </div>
            {player?.username && (
              <div className={styles.connectionRow}>
                <span className={styles.connectionLabel}>Player</span>
                <span className={styles.connectionValue}>
                  {player.username}
                </span>
              </div>
            )}
            {player?.empire && (
              <div className={styles.connectionRow}>
                <span className={styles.connectionLabel}>Empire</span>
                <span className={styles.connectionValue}>
                  {player.empire}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className={styles.logoutSection}>
          <div className={styles.divider} />
          <ActionButton
            label="Logout"
            icon={<LogOut size={14} />}
            onClick={handleLogout}
            variant="danger"
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}
