'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import type { Commands, FactionInfoResponse } from '@spacemolt/lib'
import { useAccountStore } from '@/lib/spacemolt'
import { ActionButton } from '../../ActionButton'
import styles from '../FactionPanel.module.css'
import { useRun } from './useRun'

type EditParams = Parameters<Commands['spacemolt_faction_admin']['edit']>[0]
// The server also takes and reports these two; the lib types do not list them yet.
type AllyToggles = {
  ally_facility_access?: boolean
  ally_fuel_access?: boolean
  ally_intel_opt_out?: boolean
  ally_battle_opt_out?: boolean
  ally_shipyard_access?: boolean
}

const TOGGLES: { key: keyof AllyToggles; label: string }[] = [
  { key: 'ally_facility_access', label: 'Allies may use our facilities' },
  { key: 'ally_fuel_access', label: 'Allies may draw from our fuel bunkers' },
  { key: 'ally_shipyard_access', label: 'Allies may build our licensed hulls' },
  { key: 'ally_intel_opt_out', label: 'Hide our intel from allies' },
  { key: 'ally_battle_opt_out', label: 'Do not auto-join allied battles' },
]

/** Faction description, charter, colors and ally-sharing toggles. Needs a leader or officer role. */
export function EditFactionSection({ info, onChanged }: { info: FactionInfoResponse; onChanged: () => void }) {
  const store = useAccountStore()
  const { busy, run } = useRun()
  const current = info as FactionInfoResponse & AllyToggles
  const [description, setDescription] = useState(info.description ?? '')
  const [charter, setCharter] = useState(info.charter ?? '')
  const [primary, setPrimary] = useState(info.primary_color || '#00d4ff')
  const [secondary, setSecondary] = useState(info.secondary_color || '#ff6b35')
  const [toggles, setToggles] = useState<AllyToggles>(
    Object.fromEntries(TOGGLES.map(({ key }) => [key, Boolean(current[key])])),
  )

  const save = async () => {
    const params: EditParams & AllyToggles = {
      description, charter, ...toggles,
      // Send colors only when edited, so a description save keeps an unset color unset.
      ...(primary !== (info.primary_color || '#00d4ff') && { primary_color: primary }),
      ...(secondary !== (info.secondary_color || '#ff6b35') && { secondary_color: secondary }),
    }
    if (await run('edit', () => store.account.commands.spacemolt_faction_admin.edit(params), 'Faction updated')) onChanged()
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Description</label>
        <textarea className={styles.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Charter</label>
        <textarea className={styles.textarea} rows={3} value={charter} onChange={(e) => setCharter(e.target.value)} />
      </div>
      <div className={styles.diplomacyRow}>
        <label className={styles.checkLabel}>
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} /> Primary
        </label>
        <label className={styles.checkLabel}>
          <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} /> Secondary
        </label>
      </div>
      {TOGGLES.map(({ key, label }) => (
        <label key={key} className={styles.checkLabel}>
          <input type="checkbox" checked={Boolean(toggles[key])} onChange={(e) => setToggles({ ...toggles, [key]: e.target.checked })} />
          {label}
        </label>
      ))}
      <div className={styles.formActions}>
        <ActionButton label="Save Faction" icon={<Save size={12} />} onClick={save} loading={busy === 'edit'} size="sm" />
      </div>
    </div>
  )
}
