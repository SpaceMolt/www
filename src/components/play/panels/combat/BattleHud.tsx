'use client'

import { useEffect, useRef, useState } from 'react'
import type { NotificationBattleDamage } from '@spacemolt/lib'
import { ChevronDown, ChevronUp, Crosshair, Flame, Rabbit, RotateCw, ShieldHalf, Skull, Wind } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAccountStore, useCargo, useModules, usePlayer, useShip, type BattleView } from '@/lib/spacemolt'
import { getItem } from '@/data/catalog'
import { zoneIndex } from '@/lib/battle/types'
import type { ReachRing } from '@/lib/battle/render'
import { combatKey, COMBAT_SHORTCUTS, shortcutKey, type CombatAction } from '../../shortcuts'
import { shared } from '../../shared'
import { CombatBattleView } from '../CombatBattleView'
import { enemiesOf, nextEnemy, reachZone, weaponState, zoneDistance, type WeaponState } from './combatLogic'
import styles from './BattleHud.module.css'

export type Stance = 'fire' | 'evade' | 'brace' | 'flee'
type Weapon = NonNullable<ReturnType<typeof useModules>>[number]
type CargoItem = NonNullable<ReturnType<typeof useCargo>>[number]
type Participant = BattleView['participants'][number]

const STANCES: { id: Stance; icon: typeof Flame }[] = [
  { id: 'fire', icon: Flame },
  { id: 'evade', icon: Wind },
  { id: 'brace', icon: ShieldHalf },
  { id: 'flee', icon: Rabbit },
]
const REACH_COLORS = ['#00d4ff', '#ffb703', '#2dd4bf', '#c084fc']
const LOG_LINES = 40
// Fitted modules carry no combat stats; the catalog has them.
const reachOf = (w: Weapon) => getItem(w.type_id)?.reach
let logSeq = 0

type LogLine = { id: number; tick?: number; kind: 'out' | 'in' | 'miss' | 'other' | 'sys'; who: string; dmg?: number }

export interface BattleHudProps {
  battle: BattleView
  battleId: string
  canControl: boolean
  status?: string
  weapons: Weapon[]
  ammoFor: (w: Weapon) => CargoItem[]
  ammoChoice: (w: Weapon) => string | undefined
  onPickAmmo: (weaponId: string, itemId: string) => void
  reloadAllCount: number
  onStance: (s: Stance) => void
  onAdvance: () => void
  onRetreat: () => void
  onTarget: (id: string) => void
  onReload: (weaponId: string, ammoId?: string) => void
  onReloadAll: () => void
  onSelfDestruct: () => void
}

/** The Battle tab while you are in a fight: you vs your target, the field, a keyed hotbar, weapons and the log. */
export function BattleHud(props: BattleHudProps) {
  const { battle, battleId, canControl, status, weapons, reloadAllCount, onStance, onAdvance, onRetreat, onTarget, onReloadAll } = props
  const { t } = useTranslation()
  const store = useAccountStore()
  const player = usePlayer()
  const ship = useShip()
  const me = player?.id
  const you = battle.participants.find((p) => p.player_id === me)
  const target = battle.participants.find((p) => p.player_id === battle.your_target_id)
  const enemies = enemiesOf(battle)
  const yourZone = battle.your_zone ?? you?.zone ?? ''
  const distance = target ? zoneDistance(yourZone, target.zone) : undefined
  const isEnemy = (id: string) => enemies.some((e) => e.player_id === id)

  const [log, setLog] = useState<LogLine[]>([])
  const [dealt, setDealt] = useState(0)
  const [taken, setTaken] = useState(0)
  useEffect(() => {
    const add = (line: Omit<LogLine, 'id'>) => setLog((lines) => [{ ...line, id: logSeq++ }, ...lines].slice(0, LOG_LINES))
    const onDamage = (d: NotificationBattleDamage) => {
      const kind = !d.hit_success ? 'miss' : d.attacker_id === me ? 'out' : d.target_id === me ? 'in' : 'other'
      if (kind === 'out') setDealt((n) => n + d.total_damage)
      if (kind === 'in') setTaken((n) => n + d.total_damage)
      const name = (id: string, n?: string) => (id === me ? 'You' : n || id)
      add({ tick: d.tick, kind, who: `${name(d.attacker_id, d.attacker_name)} > ${name(d.target_id, d.target_name)}`, dmg: d.hit_success ? d.total_damage : undefined })
    }
    const offDamage = store.account.on('battle_damage', onDamage)
    const offJoined = store.account.on('battle_joined', (j) => add({ kind: 'sys', who: `${j.username} joined side ${j.side_id}` }))
    return () => {
      offDamage()
      offJoined()
    }
  }, [store, me])

  // Keys go through a ref so the listener never re-binds mid-fight.
  const actions = useRef<Record<CombatAction, () => void>>(null!)
  actions.current = {
    fire: () => onStance('fire'),
    evade: () => onStance('evade'),
    brace: () => onStance('brace'),
    flee: () => onStance('flee'),
    advance: onAdvance,
    retreat: onRetreat,
    target: () => {
      const next = nextEnemy(enemies, battle.your_target_id)
      if (canControl && next) onTarget(next.player_id)
    },
    reload: () => canControl && reloadAllCount > 0 && onReloadAll(),
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = shortcutKey(e)
      const hit = COMBAT_SHORTCUTS.find((s) => s.key === key)
      if (!hit || document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      actions.current[hit.action]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // One ring per distinct reach; weapons that share a reach share a ring.
  const byReach = new Map<number, string[]>()
  weapons.forEach((w) => {
    const reach = reachOf(w)
    if (reach !== undefined) byReach.set(reach, [...(byReach.get(reach) ?? []), w.name])
  })
  const reachRings: ReachRing[] = [...byReach].flatMap(([reach, names], i) => {
    const zone = reachZone(yourZone, reach)
    return zone === undefined ? [] : [{ zone, color: REACH_COLORS[i % REACH_COLORS.length], label: `${names.join(', ')} · reach ${reach}` }]
  })

  return (
    <div className={styles.hud}>
      <div className={`${styles.box} ${styles.bar}`}>
        <span className={styles.live}>In combat</span>
        {battle.tick !== undefined && <span className={styles.label}>Tick {battle.tick}</span>}
        {battle.auto_pilot && <span className={styles.label}>Auto-pilot</span>}
        {status && <span className={styles.warn}>{status}</span>}
        <span className={styles.barHint}>Commands take effect on the next tick.</span>
      </div>

      <div className={styles.faceoff}>
        <ShipCard side="you" name={you?.username ?? player?.username ?? 'You'} sub={you?.ship_class}
          shield={ship?.max_shield ? [ship.shield ?? 0, ship.max_shield] : pctPair(you?.shield_pct)}
          hull={ship ? [ship.hull, ship.max_hull] : pctPair(you?.hull_pct)}
          zone={yourZone} stance={battle.your_stance} />
        <div className={`${styles.box} ${styles.range}`} aria-live="polite">
          <span className={styles.label}>Range</span>
          <span className={styles.rangeNum}>{distance ?? '-'}</span>
          <span className={styles.label}>of 6</span>
        </div>
        {target ? (
          <ShipCard side="target" name={target.username} sub={target.ship_class}
            shield={pctPair(target.shield_pct)} hull={pctPair(target.hull_pct)} zone={target.zone} stance={target.stance} />
        ) : (
          <div className={`${styles.box} ${styles.ship} ${styles.target} ${styles.noTarget}`}>
            <span className={styles.shipName}>No target</span>
            <span className={styles.label}>Your ship picks one. Press {combatKey('target')} or click an enemy to choose.</span>
          </div>
        )}
      </div>

      <CombatBattleView key={battleId} battleId={battleId} playerId={me} participating reachRings={reachRings}
        onPickShip={(id) => canControl && isEnemy(id) && onTarget(id)} />

      <div className={styles.main}>
        <div className={styles.col}>
          <fieldset className={`${styles.box} ${styles.sect}`} disabled={!canControl}>
            <legend className={styles.label}>Stance and moves</legend>
            <div className={styles.hotbar}>
              {STANCES.map(({ id, icon: Icon }) => (
                <HotKey key={id} action={id} on={battle.your_stance === id} onClick={() => onStance(id)}
                  title={<><Icon size={13} aria-hidden /> {t(`battles.playCombat.stance.${id}`)}</>} detail={t(`battles.playCombat.stanceHint.${id}`)} />
              ))}
            </div>
            <div className={styles.hotbar}>
              <HotKey action="advance" onClick={onAdvance} title={<><ChevronUp size={13} aria-hidden /> {t('battles.playCombat.advance')}</>} detail="One zone toward the centre. Range -1." />
              <HotKey action="retreat" onClick={onRetreat} title={<><ChevronDown size={13} aria-hidden /> {t('battles.playCombat.retreat')}</>} detail="One zone toward the rim. Range +1." />
              <HotKey action="target" onClick={actions.current.target} title={<><Crosshair size={13} aria-hidden /> Next target</>} detail="Cycle enemies, or click one on the field." />
              <HotKey action="reload" onClick={onReloadAll} disabled={reloadAllCount === 0} title={<><RotateCw size={13} aria-hidden /> Reload all</>}
                detail={reloadAllCount ? `Reload ${reloadAllCount} weapon${reloadAllCount === 1 ? '' : 's'} in one tick.` : 'Nothing to reload.'} />
            </div>
          </fieldset>

          <section className={`${styles.box} ${styles.sect}`}>
            <span className={styles.label}>Weapons</span>
            {weapons.length === 0 && <span className={styles.muted}>No weapons fitted.</span>}
            {weapons.map((w) => (
              <WeaponCard key={w.module_id} weapon={w} canControl={canControl} ammoFor={props.ammoFor} ammoChoice={props.ammoChoice}
                onPickAmmo={props.onPickAmmo} onReload={props.onReload} state={weaponState({ ammo: w.current_ammo, magazine: w.magazine_size, reach: reachOf(w), distance })}
                canClose={3 - zoneIndex(yourZone)} />
            ))}
          </section>
        </div>

        <div className={styles.col}>
          <section className={`${styles.box} ${styles.sect}`}>
            <span className={styles.label}>This battle</span>
            <div className={styles.totals}>
              <div className={styles.tot}><span className={styles.label}>Damage dealt</span><span className={`${styles.totNum} ${styles.out}`}>{dealt}</span></div>
              <div className={styles.tot}><span className={styles.label}>Damage taken</span><span className={`${styles.totNum} ${styles.in}`}>{taken}</span></div>
            </div>
            <ol className={styles.log} aria-live="polite">
              {log.length === 0 && <li className={styles.muted}>No shots yet.</li>}
              {log.map((l) => (
                <li key={l.id} className={styles[l.kind]}>
                  <span className={styles.muted}>{l.tick !== undefined ? `T${l.tick}` : ''}</span>
                  <span>{l.who}</span>
                  <span className={styles.dmg}>{l.kind === 'miss' ? 'miss' : l.dmg ?? ''}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${styles.box} ${styles.sect}`}>
            <span className={styles.label}>Combatants · click an enemy to target</span>
            <div className={styles.roster}>
              {battle.participants.map((p) => (
                <RosterRow key={p.player_id} p={p} you={p.player_id === me} enemy={isEnemy(p.player_id)}
                  targeted={p.player_id === battle.your_target_id} disabled={!canControl} onTarget={onTarget} />
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className={`${styles.box} ${styles.foot}`}>
        <span className={styles.muted}>To leave, take the flee stance. Self-destruct ends the fight for good.</span>
        <button className={shared.dangerBtn} onClick={props.onSelfDestruct} type="button"><Skull size={13} aria-hidden /> Self-destruct</button>
      </div>
    </div>
  )
}

const pctPair = (pct?: number): [number, number] => [pct ?? 0, 100]

function ShipCard({ side, name, sub, shield, hull, zone, stance }: {
  side: 'you' | 'target'; name: string; sub?: string; shield: [number, number]; hull: [number, number]; zone?: string; stance?: string
}) {
  const meter = (label: string, [now, max]: [number, number], fill: string) => (
    <div className={styles.meter}>
      <span className={styles.label}>{label}</span>
      <div className={styles.track}><i className={fill} style={{ width: `${max ? (100 * now) / max : 0}%` }} /></div>
      <span className={styles.num}>{max === 100 ? `${now}%` : `${now} / ${max}`}</span>
    </div>
  )
  return (
    <div className={`${styles.box} ${styles.ship} ${styles[side]}`}>
      <div>
        <div className={styles.shipName}>{name}</div>
        {sub && <div className={styles.muted}>{sub}</div>}
      </div>
      {meter('Shield', shield, styles.shd)}
      {meter('Hull', hull, hull[1] && hull[0] / hull[1] < 0.3 ? styles.hulLow : styles.hul)}
      <div className={styles.pills}>
        {zone && <span className={styles.pill}>{zone}</span>}
        {stance && <span className={`${styles.pill} ${styles.stancePill}`}>{stance}</span>}
      </div>
    </div>
  )
}

function HotKey({ action, title, detail, on, disabled, onClick }: {
  action: CombatAction; title: React.ReactNode; detail: string; on?: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <button className={`${styles.hk} ${on ? styles.hkOn : ''} ${action === 'flee' ? styles.hkFlee : ''}`} onClick={onClick}
      disabled={disabled} aria-pressed={on} aria-keyshortcuts={combatKey(action)} type="button">
      <kbd className={styles.key}>{combatKey(action)}</kbd>
      <span className={styles.hkTitle}>{title}</span>
      <span className={styles.hkDetail}>{detail}</span>
    </button>
  )
}

const STATE_TEXT = { ready: 'Can hit', idle: 'No target', empty: 'Empty' } as const

function WeaponCard({ weapon: w, state, canClose, canControl, ammoFor, ammoChoice, onPickAmmo, onReload }: {
  weapon: Weapon; state: WeaponState; canClose: number; canControl: boolean
} & Pick<BattleHudProps, 'ammoFor' | 'ammoChoice' | 'onPickAmmo' | 'onReload'>) {
  const options = ammoFor(w)
  const choice = ammoChoice(w)
  const spec = getItem(w.type_id)
  const chip = state.kind === 'far'
    ? state.advances <= canClose ? `Out of range · advance ${state.advances}` : 'Out of range'
    : STATE_TEXT[state.kind]
  return (
    <div className={`${styles.wpn} ${state.kind === 'empty' ? styles.wpnEmpty : ''}`}>
      <div className={styles.wpnHead}>
        <span className={styles.wpnName}>{w.name}</span>
        <span className={`${styles.chip} ${styles[`chip_${state.kind}`]}`}>{chip}</span>
      </div>
      <span className={styles.muted}>
        {[spec?.reach !== undefined && `reach ${spec.reach}`, spec?.damage && `${spec.damage} ${spec.damage_type ?? ''} dmg`, w.loaded_ammo_name].filter(Boolean).join(' · ')}
      </span>
      {w.magazine_size !== undefined && <>
        <div className={styles.meter}>
          <span className={styles.label}>Ammo</span>
          <div className={styles.track}><i className={styles.ammoFill} style={{ width: `${w.magazine_size ? (100 * (w.current_ammo ?? 0)) / w.magazine_size : 0}%` }} /></div>
          <span className={styles.num}>{w.current_ammo ?? 0} / {w.magazine_size}</span>
        </div>
        {options.length === 0 ? (
          <span className={styles.muted}>No {w.ammo_type ? `${w.ammo_type} ` : ''}ammo in cargo</span>
        ) : (
          <div className={styles.reload}>
            <select className={shared.selectInput} value={choice ?? ''} aria-label={`Ammo for ${w.name}`} onChange={(e) => onPickAmmo(w.module_id, e.target.value)}>
              <option value="">Select ammo</option>
              {options.map((item) => <option key={item.item_id} value={item.item_id}>{item.item_name} (x{item.quantity})</option>)}
            </select>
            <button className={styles.btn} onClick={() => onReload(w.module_id, choice)} disabled={!choice || !canControl} type="button">
              <RotateCw size={12} aria-hidden /> Reload
            </button>
          </div>
        )}
      </>}
    </div>
  )
}

function RosterRow({ p, you, enemy, targeted, disabled, onTarget }: {
  p: Participant; you: boolean; enemy: boolean; targeted: boolean; disabled: boolean; onTarget: (id: string) => void
}) {
  const body = <>
    <span className={styles.rosterName}>{p.username}{you ? ' (you)' : ''}<span className={styles.muted}> {p.ship_class}</span></span>
    <span className={styles.duo}>
      <span className={styles.track}><i className={styles.shd} style={{ width: `${p.shield_pct ?? 0}%` }} /></span>
      <span className={styles.track}><i className={(p.hull_pct ?? 0) < 30 ? styles.hulLow : styles.hul} style={{ width: `${p.hull_pct ?? 0}%` }} /></span>
    </span>
    <span className={styles.muted}>{p.zone}</span>
  </>
  const cls = `${styles.rrow} ${enemy ? styles.foe : styles.ally} ${targeted ? styles.targeted : ''}`
  return enemy
    ? <button className={cls} onClick={() => onTarget(p.player_id)} disabled={disabled} aria-pressed={targeted} title={`Target ${p.username}`} type="button">{body}</button>
    : <div className={cls}>{body}</div>
}
