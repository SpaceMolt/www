'use client'

import { useState, useCallback } from 'react'
import { Settings, Palette, Home, LogOut, Bell } from 'lucide-react'
import type { NotificationSettingsResponse } from '@spacemolt/lib'
import { useAccountStore, useCommandQuery, useConnectionPhase, useCurrentTick, useLocationState, usePlayer } from '@/lib/spacemolt'
import { usePlay } from '../PlayProvider'
import { ActionButton } from '../ActionButton'
import { Panel, Loading, shared, errorMessage } from '../shared'
import { titleCase } from '@/lib/format'
import styles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const store = useAccountStore()
  const { onSwitchPlayer, uiStore } = usePlay()
  const player = usePlayer()
  const location = useLocationState()
  const { phase } = useConnectionPhase()
  const connected = phase === 'ready'
  const currentTick = useCurrentTick()

  const [statusMsg, setStatusMsg] = useState(player?.status_message ?? '')
  const [clanTag, setClanTag] = useState(player?.clan_tag ?? '')
  const [primaryColor, setPrimaryColor] = useState(player?.primary_color ?? '#00d4ff')
  const [secondaryColor, setSecondaryColor] = useState(player?.secondary_color ?? '#ff6b35')
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingTag, setSavingTag] = useState(false)
  const [savingColors, setSavingColors] = useState(false)
  const [settingHome, setSettingHome] = useState(false)

  const [notifSettings, setNotifSettings] = useState<NotificationSettingsResponse | null>(null)
  const [savingChannel, setSavingChannel] = useState<string | null>(null)
  const notifQuery = useCommandQuery(
    async (account) => (await account.commands.spacemolt_social.get_notification_settings()).structuredContent,
    [],
  )
  const notifications = notifSettings ?? notifQuery.data

  const reportError = useCallback(
    (err: unknown) => uiStore.dispatch({ type: 'toast', kind: 'danger', text: errorMessage(err) }),
    [uiStore],
  )

  const handleNotifications = useCallback(
    (channel: string, run: () => Promise<{ structuredContent?: NotificationSettingsResponse }>) => {
      setSavingChannel(channel)
      run()
        .then((resp) => setNotifSettings(resp.structuredContent ?? null))
        .catch(reportError)
        .finally(() => setSavingChannel(null))
    },
    [reportError],
  )

  const dockedAt = location?.docked_at
  const isDocked = Boolean(dockedAt)

  const handleSaveStatus = useCallback(() => {
    setSavingStatus(true)
    store.account.commands.spacemolt_social
      .set_status({ content: statusMsg })
      .catch(reportError)
      .finally(() => setSavingStatus(false))
  }, [store, statusMsg, reportError])

  const handleSaveTag = useCallback(() => {
    setSavingTag(true)
    store.account.commands.spacemolt_social
      .set_status({ clan_tag: clanTag.toUpperCase() })
      .catch(reportError)
      .finally(() => setSavingTag(false))
  }, [store, clanTag, reportError])

  const handleSaveColors = useCallback(() => {
    setSavingColors(true)
    store.account.commands.spacemolt_social
      .set_colors({ primary_color: primaryColor, secondary_color: secondaryColor })
      .catch(reportError)
      .finally(() => setSavingColors(false))
  }, [store, primaryColor, secondaryColor, reportError])

  const handleSetHomeBase = useCallback(() => {
    if (!dockedAt) return
    setSettingHome(true)
    store.account.commands.spacemolt_salvage
      .set_home({ id: dockedAt })
      .catch(reportError)
      .finally(() => setSettingHome(false))
  }, [store, dockedAt, reportError])

  const handleLogout = useCallback(() => {
    void store.account.logout().catch(() => {})
    if (onSwitchPlayer) onSwitchPlayer()
  }, [store, onSwitchPlayer])

  return (
    <Panel title="Settings" icon={<Settings size={16} />}>
        {/* Status Message */}
        <div>
          <div className={shared.sectionTitle}>
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
          <div className={shared.sectionTitle}>
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
          <div className={shared.sectionTitle}>
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

        {/* Set Home Base */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><Home size={12} /></span>
            Home Base
          </div>
          {player?.home_base && (
            <div className={styles.connectionCard} style={{ marginBottom: '0.5rem' }}>
              <div className={styles.connectionRow}>
                <span className={styles.connectionLabel}>Home Base</span>
                <span className={styles.connectionValue}>{titleCase(player.home_base)}</span>
              </div>
            </div>
          )}
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

        {/* Notification channels */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><Bell size={12} /></span>
            Notifications
          </div>
          {!notifications ? (
            notifQuery.error
              ? <div className={shared.emptyState}>{notifQuery.error}</div>
              : <Loading message="Loading notification settings..." />
          ) : (
            <div className={styles.channelList}>
              {notifications.channels.map((channel) => (
                <div key={channel.channel} className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <span className={styles.toggleLabel}>{titleCase(channel.channel.replace(/\./g, ' '))}</span>
                    <span className={styles.toggleDesc}>{channel.description}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!channel.muted}
                    aria-label={`${channel.muted ? 'Unmute' : 'Mute'} ${titleCase(channel.channel.replace(/\./g, ' '))}`}
                    className={`${styles.toggleSwitch} ${channel.muted ? '' : styles.toggleSwitchOn}`}
                    disabled={savingChannel !== null}
                    onClick={() =>
                      handleNotifications(channel.channel, () =>
                        channel.muted
                          ? store.account.commands.spacemolt_social.unmute_notifications({ channels: [channel.channel] })
                          : store.account.commands.spacemolt_social.mute_notifications({ channels: [channel.channel] }),
                      )
                    }
                  />
                </div>
              ))}
              <ActionButton
                label="Unmute All"
                icon={<Bell size={12} />}
                onClick={() =>
                  handleNotifications('*', () => store.account.commands.spacemolt_social.unmute_notifications({ all: true }))
                }
                disabled={savingChannel !== null || notifications.muted.length === 0}
                loading={savingChannel === '*'}
                variant="secondary"
                size="sm"
              />
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Connection Info */}
        <div>
          <div className={shared.sectionTitle}>
            <span className={styles.sectionIcon}><Settings size={12} /></span>
            Connection
          </div>
          <div className={styles.connectionCard}>
            <div className={styles.connectionRow}>
              <span className={styles.connectionLabel}>Status</span>
              <span className={
                connected
                  ? styles.connectionValueOnline
                  : styles.connectionValueOffline
              }>
                <span className={`${styles.statusDot} ${
                  connected ? styles.statusDotOnline : styles.statusDotOffline
                }`} />
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className={styles.connectionRow}>
              <span className={styles.connectionLabel}>Tick</span>
              <span className={styles.connectionValue}>
                {currentTick}
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
    </Panel>
  )
}
