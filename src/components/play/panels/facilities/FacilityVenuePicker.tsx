'use client'

import { Warehouse, Factory, Users, Globe, Check } from 'lucide-react'
import { Modal, shared } from '../../shared'
import type { FacilityWithProduction } from '../../types'
import styles from './facilities.module.css'

interface FacilityVenuePickerProps {
  recipeName: string
  /** Candidate facilities already filtered to ones that produce this recipe. */
  ownFacilities: FacilityWithProduction[]
  factionFacilities: FacilityWithProduction[]
  publicFacilities: FacilityWithProduction[]
  selected?: string
  onSelect: (facilityId: string | undefined) => void
  onClose: () => void
}

function VenueOption({
  icon, name, meta, selected, onClick,
}: {
  icon: React.ReactNode
  name: string
  meta: string[]
  selected: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={styles.typeDetail} onClick={onClick} style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}>
      <div className={styles.typeHeader}>
        <span className={styles.typeName}>{icon} {name}</span>
        {selected && <Check size={14} className={shared.badgeGreen} />}
      </div>
      <div className={styles.costBreakdown}>
        {meta.map((line, i) => (
          <div key={i} className={styles.costRow}>
            <span className={styles.costValue}>{line}</span>
          </div>
        ))}
      </div>
    </button>
  )
}

export function FacilityVenuePicker({
  recipeName, ownFacilities, factionFacilities, publicFacilities, selected, onSelect, onClose,
}: FacilityVenuePickerProps) {
  const handlePick = (facilityId: string | undefined) => {
    onSelect(facilityId)
    onClose()
  }

  const groups: { icon: React.ReactNode; suffix: string; facilities: FacilityWithProduction[] }[] = [
    { icon: <Factory size={12} />, suffix: '', facilities: ownFacilities },
    { icon: <Users size={12} />, suffix: ' (faction)', facilities: factionFacilities },
    { icon: <Globe size={12} />, suffix: ' (rental)', facilities: publicFacilities },
  ]

  return (
    <Modal title={`Venue — ${recipeName}`} icon={<Factory size={14} />} onClose={onClose}>
      <VenueOption
        icon={<Warehouse size={12} />}
        name="Station Workshop"
        meta={['Free, scales with your skills, slowest throughput']}
        selected={!selected}
        onClick={() => handlePick(undefined)}
      />

      {groups.flatMap(({ icon, suffix, facilities }) => facilities.map(f => (
        <VenueOption
          key={f.facility_id}
          icon={icon}
          name={`${f.custom_name || f.name}${suffix}`}
          meta={facilityMeta(f)}
          selected={selected === f.facility_id}
          onClick={() => handlePick(f.facility_id)}
        />
      )))}

      {ownFacilities.length === 0 && factionFacilities.length === 0 && publicFacilities.length === 0 && (
        <div className={shared.emptyState}>
          No facilities here produce this recipe — Station Workshop is your only venue.
        </div>
      )}
    </Modal>
  )
}

function facilityMeta(f: FacilityWithProduction): string[] {
  const p = f.production
  if (!p) return [`Level ${f.level}`]
  const lines: string[] = []
  if (p.ticks_per_run) lines.push(`${p.ticks_per_run} ticks/run · ${p.items_per_hour ?? '?'} items/hr`)
  if (p.queued_runs > 0) lines.push(`Backlog: ${p.queued_runs} run${p.queued_runs === 1 ? '' : 's'} queued (~${p.backlog_ticks} ticks)`)
  else lines.push('No backlog — starts immediately')
  if (p.rental_fee_per_run) lines.push(`Rental fee: ${p.rental_fee_per_run.toLocaleString()} cr/run`)
  return lines
}
