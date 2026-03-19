'use client'

import { useState, useCallback } from 'react'
import { Building2, Shield, Wrench, Heart, Hammer, RefreshCw, Anchor, ArrowUpFromLine, Coins } from 'lucide-react'
import { useGame } from '../GameProvider'
import { ActionButton } from '../ActionButton'
import type { GetBaseResponse, Wreck } from '../types'
import styles from './BasePanel.module.css'

const STATION_TYPES = ['outpost', 'station', 'fortress'] as const
const AVAILABLE_SERVICES = [
  'market',
  'refinery',
  'repair',
  'cloning',
  'insurance',
  'shipyard',
  'storage',
]

export function BasePanel() {
  const { state, sendCommand } = useGame()
  const [baseInfo, setBaseInfo] = useState<GetBaseResponse | null>(null)
  const [wrecks, setWrecks] = useState<Wreck[]>([])
  const [wrecksLoaded, setWrecksLoaded] = useState(false)
  const [loadingWrecks, setLoadingWrecks] = useState(false)
  const [expandedWreck, setExpandedWreck] = useState<string | null>(null)
  const [lootingItem, setLootingItem] = useState<string | null>(null)
  const [salvaging, setSalvaging] = useState(false)

  // Build base form
  const [buildName, setBuildName] = useState('')
  const [buildType, setBuildType] = useState<typeof STATION_TYPES[number]>('outpost')
  const [buildServices, setBuildServices] = useState<string[]>([])
  const [building, setBuilding] = useState(false)

  // Insurance
  const [coveragePct, setCoveragePct] = useState('50')
  const [buyingInsurance, setBuyingInsurance] = useState(false)
  const [settingHome, setSettingHome] = useState(false)

  const isDocked = state.isDocked

  const toggleService = useCallback((service: string) => {
    setBuildServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    )
  }, [])

  const handleGetCost = useCallback(() => {
    sendCommand('get_base_cost')
  }, [sendCommand])

  const handleBuildBase = useCallback(() => {
    if (!buildName.trim()) return
    setBuilding(true)
    sendCommand('build_base', {
      name: buildName.trim(),
      type: buildType,
      services: buildServices,
    })
    setTimeout(() => setBuilding(false), 2000)
  }, [sendCommand, buildName, buildType, buildServices])

  const handleBuyInsurance = useCallback(() => {
    const pct = parseInt(coveragePct, 10)
    if (isNaN(pct) || pct < 1 || pct > 100) return
    setBuyingInsurance(true)
    sendCommand('buy_insurance', { coverage_percent: pct })
    setTimeout(() => setBuyingInsurance(false), 2000)
  }, [sendCommand, coveragePct])

  const handleSetHomeBase = useCallback(() => {
    setSettingHome(true)
    sendCommand('set_home_base')
    setTimeout(() => setSettingHome(false), 2000)
  }, [sendCommand])

  const handleLoadWrecks = useCallback(() => {
    setLoadingWrecks(true)
    const handler = (e: Event) => {
      setWrecks((e as CustomEvent).detail)
      setLoadingWrecks(false)
      setWrecksLoaded(true)
    }
    window.addEventListener('spacemolt:wrecks', handler, { once: true })
    sendCommand('get_base_wrecks')
    setTimeout(() => {
      window.removeEventListener('spacemolt:wrecks', handler)
      setLoadingWrecks(false)
      setWrecksLoaded(true)
    }, 5000)
  }, [sendCommand])

  const handleLootItem = useCallback(
    async (wreckId: string, itemId: string) => {
      setLootingItem(itemId)
      try {
        await sendCommand('loot_wreck', { wreck_id: wreckId, item_id: itemId })
        sendCommand('get_base_wrecks')
      } finally {
        setLootingItem(null)
      }
    },
    [sendCommand]
  )

  const handleSalvageWreck = useCallback(
    async (wreckId: string) => {
      setSalvaging(true)
      try {
        await sendCommand('salvage_wreck', { wreck_id: wreckId })
        setExpandedWreck(null)
        sendCommand('get_base_wrecks')
      } finally {
        setSalvaging(false)
      }
    },
    [sendCommand]
  )

  const handleAttackBase = useCallback(() => {
    sendCommand('attack_base')
  }, [sendCommand])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon}><Building2 size={16} /></span>
          Base
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleLoadWrecks}
          title="Scan for wrecks"
          disabled={loadingWrecks}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={styles.content}>
        {isDocked ? (
          <>
            {/* Base Info (when docked) */}
            <div>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Building2 size={12} /></span>
                Current Base
              </div>
              {state.poi?.name ? (
                <div className={styles.baseCard}>
                  <div className={styles.baseName}>{state.poi.name}</div>
                  <div className={styles.baseMeta}>
                    <span className={styles.metaTag}>
                      Type: <span className={styles.metaValue}>
                        {baseInfo?.base.type ?? 'Unknown'}
                      </span>
                    </span>
                    <span className={styles.metaTag}>
                      <Shield size={10} />
                      Defense: <span className={styles.metaValue}>
                        {baseInfo?.base.defense_level ?? '--'}
                      </span>
                    </span>
                    {baseInfo?.condition && (
                      <span className={styles.metaTag}>
                        Condition: <span className={styles.metaValue}>
                          {baseInfo.condition.condition}
                        </span>
                      </span>
                    )}
                  </div>
                  {baseInfo?.services && baseInfo.services.length > 0 && (
                    <div className={styles.serviceList}>
                      {baseInfo.services.map((s) => (
                        <span key={s} className={styles.serviceTag}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  Docked at a POI without base information.
                </div>
              )}
            </div>

            <div className={styles.divider} />

            {/* Insurance */}
            <div>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Heart size={12} /></span>
                Insurance
              </div>
              <div className={styles.insuranceRow}>
                <input
                  className={styles.coverageInput}
                  type="number"
                  min="1"
                  max="100"
                  value={coveragePct}
                  onChange={(e) => setCoveragePct(e.target.value)}
                />
                <span className={styles.coverageLabel}>% coverage</span>
                <ActionButton
                  label="Buy"
                  icon={<Heart size={12} />}
                  onClick={handleBuyInsurance}
                  disabled={buyingInsurance}
                  loading={buyingInsurance}
                  size="sm"
                />
              </div>
            </div>

            <div className={styles.divider} />

            {/* Set Home Base */}
            <div>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Anchor size={12} /></span>
                Home Base
              </div>
              <ActionButton
                label="Set as Home Base"
                icon={<Anchor size={14} />}
                onClick={handleSetHomeBase}
                disabled={settingHome}
                loading={settingHome}
                size="sm"
              />
            </div>

            <div className={styles.divider} />

            {/* Base Raiding */}
            <div>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Hammer size={12} /></span>
                Raid Base
              </div>
              <ActionButton
                label="Attack Base"
                icon={<Hammer size={14} />}
                onClick={handleAttackBase}
                variant="danger"
                size="sm"
              />
            </div>
          </>
        ) : (
          <>
            {/* Not docked -- show build option */}
            <div className={styles.notDockedMsg}>
              <span className={styles.notDockedIcon}>
                <Building2 size={14} />
              </span>
              You are not docked. Dock at a base for services, or build one here.
            </div>

            <div className={styles.divider} />

            {/* Build Base */}
            <div>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Wrench size={12} /></span>
                Build Base
              </div>
              <div className={styles.buildForm}>
                <div className={styles.field}>
                  <label className={styles.label}>Station Name</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="e.g. Wolf Den Outpost"
                    value={buildName}
                    onChange={(e) => setBuildName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Station Type</label>
                  <div className={styles.typeSelector}>
                    {STATION_TYPES.map((type) => (
                      <button
                        key={type}
                        className={`${styles.typeOption} ${
                          buildType === type ? styles.typeOptionSelected : ''
                        }`}
                        onClick={() => setBuildType(type)}
                        type="button"
                      >
                        <span className={styles.typeOptionIcon}>
                          <Building2 size={16} />
                        </span>
                        <span className={styles.typeOptionLabel}>{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Services</label>
                  <div className={styles.checkboxGroup}>
                    {AVAILABLE_SERVICES.map((svc) => (
                      <label key={svc} className={styles.checkbox}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={buildServices.includes(svc)}
                          onChange={() => toggleService(svc)}
                        />
                        <span className={styles.checkboxLabel}>{svc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.buildActions}>
                  <ActionButton
                    label="Get Cost"
                    icon={<Wrench size={12} />}
                    onClick={handleGetCost}
                    variant="secondary"
                    size="sm"
                  />
                  <ActionButton
                    label="Build"
                    icon={<Hammer size={12} />}
                    onClick={handleBuildBase}
                    disabled={!buildName.trim() || building}
                    loading={building}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className={styles.divider} />

        {/* Wrecks at POI */}
        <div>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}><Shield size={12} /></span>
            Wrecks at POI
          </div>
          {!wrecksLoaded && !loadingWrecks && (
            <ActionButton
              label="Scan for Wrecks"
              icon={<Shield size={14} />}
              onClick={handleLoadWrecks}
              variant="secondary"
              size="sm"
            />
          )}
          {loadingWrecks && (
            <div className={styles.loading}>
              <span className={styles.spinner} />
              Scanning...
            </div>
          )}
          {wrecksLoaded && wrecks.length === 0 && (
            <div className={styles.emptyState}>
              No wrecks detected at this location.
            </div>
          )}
          {wrecks.length > 0 && (
            <div className={styles.wreckList}>
              {wrecks.map((w) => (
                <div key={w.id} className={styles.wreckItem}>
                  <button
                    className={styles.wreckHeader}
                    onClick={() => setExpandedWreck(expandedWreck === w.id ? null : w.id)}
                    type="button"
                  >
                    <div className={styles.wreckInfo}>
                      <span className={styles.wreckName}>
                        {w.victim_name} - {w.ship_class ?? 'Wreck'}
                      </span>
                      <span className={styles.wreckMeta}>
                        {w.cargo.length} items{w.salvage_value ? ` · ${w.salvage_value.toLocaleString()} cr salvage` : ''}
                      </span>
                    </div>
                    <span className={styles.wreckTimer}>
                      tick {w.expire_tick}
                    </span>
                  </button>
                  {expandedWreck === w.id && (
                    <div className={styles.wreckContents}>
                      {w.cargo.length > 0 ? (
                        <div className={styles.wreckItemList}>
                          {w.cargo.map((item) => (
                            <div key={item.item_id} className={styles.wreckLootRow}>
                              <span className={styles.wreckLootName}>
                                {item.name ?? item.item_id} x{item.quantity}
                              </span>
                              <button
                                className={styles.lootBtn}
                                onClick={() => handleLootItem(w.id, item.item_id)}
                                disabled={lootingItem === item.item_id}
                                type="button"
                              >
                                <ArrowUpFromLine size={10} />
                                {lootingItem === item.item_id ? 'Taking...' : 'Take'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.emptyState}>No items remaining</div>
                      )}
                      {w.salvage_value > 0 && (
                        <div className={styles.wreckCredits}>
                          <Coins size={10} /> {w.salvage_value.toLocaleString()} cr salvage value
                        </div>
                      )}
                      <button
                        className={styles.salvageBtn}
                        onClick={() => handleSalvageWreck(w.id)}
                        disabled={salvaging}
                        type="button"
                      >
                        <Hammer size={12} />
                        {salvaging ? 'Salvaging...' : 'Salvage Wreck'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
