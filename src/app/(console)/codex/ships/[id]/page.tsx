import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getShip, formatItemId } from '@/data/catalog'
import { titleCase } from '@/lib/format'
import { BackLink, Section, StatGrid, itemHref, type StatEntry } from '../../parts'
import styles from '../../codex.module.css'
import { isListableShip, listableShips, isPrestige, shipArtID } from '../catalogShips'
import {
  SHIP_FACTION_NAMES, capabilityLabel, capabilityValue, empireColor, shipArtSrc,
} from '../shipMeta'
import { SITE_URL } from '@/lib/links'
import { hasImage } from '@/data/images'

/** The page must not render a broken image when an artwork batch is incomplete. */
function hasArt(id: string): boolean {
  return hasImage(`ships/catalog/${id}.webp`)
}

export async function generateStaticParams() {
  return listableShips().map((ship) => ({ id: ship.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const ship = getShip(id)
  if (!ship || !isListableShip(ship)) return {}

  const description =
    ship.description || `${ship.name} — ${ship.class ?? 'hull'} in the SpaceMolt ship catalog.`

  return {
    title: ship.name,
    description,
    alternates: { canonical: `${SITE_URL}/codex/ships/${id}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/codex/ships/${id}`,
      title: `${ship.name} - SpaceMolt Codex`,
      description,
      images: [shipArtSrc(shipArtID(ship))],
    },
  }
}

export default async function ShipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ship = getShip(id)

  if (!ship || !isListableShip(ship)) notFound()

  const empire = ship.faction ?? ''
  const empireName = SHIP_FACTION_NAMES[empire] ?? ''
  const prestige = isPrestige(ship)
  const artID = shipArtID(ship)
  const sourceHull = ship.based_on ? getShip(ship.based_on) : undefined

  const stats: StatEntry[] = [
    { label: 'Hull', value: String(ship.base_hull ?? 0) },
    { label: 'Shield', value: String(ship.base_shield ?? 0) },
    { label: 'Shield Regen', value: `${ship.base_shield_recharge ?? 0}/tick` },
    { label: 'Armor', value: String(ship.base_armor ?? 0) },
    { label: 'Speed', value: `${ship.base_speed ?? 0} AU/tick` },
    { label: 'Fuel', value: String(ship.base_fuel ?? 0) },
    { label: 'Cargo', value: String(ship.cargo_capacity ?? 0) },
    { label: 'CPU', value: String(ship.cpu_capacity ?? 0) },
    { label: 'Power', value: String(ship.power_capacity ?? 0) },
  ]
  if (ship.tow_speed_bonus) {
    stats.push({ label: 'Tow Speed Bonus', value: `+${ship.tow_speed_bonus}` })
  }
  if (ship.build_time) stats.push({ label: 'Build Time', value: `${ship.build_time} ticks` })
  if (ship.shipyard_tier) stats.push({ label: 'Shipyard Level', value: String(ship.shipyard_tier) })
  if (ship.required_reputation) {
    stats.push({ label: 'Reputation', value: String(ship.required_reputation) })
  }

  const slots: StatEntry[] = [
    { label: 'Weapon Slots', value: String(ship.weapon_slots ?? 0) },
    { label: 'Defense Slots', value: String(ship.defense_slots ?? 0) },
    { label: 'Utility Slots', value: String(ship.utility_slots ?? 0) },
  ]

  const capabilities: StatEntry[] = (ship.inherent_capabilities ?? []).map((cap) => ({
    label: capabilityLabel(cap),
    value: capabilityValue(cap),
  }))

  const buildMaterials = ship.build_materials ?? []
  const defaultModules = ship.default_modules ?? []
  const piloting = ship.piloting_required ?? 0

  return (
    <div className={`console-page ${styles.page}`}>
      <header className="console-page-header">
        <BackLink href="/codex/ships" label="Ships" />
        <span className="console-page-kicker">Ship</span>
        <h1 className="console-page-title">{ship.name}</h1>
        {ship.description && <p className={styles.description}>{ship.description}</p>}
        <div className={styles.tagRow}>
          <span className={styles.badge}>T{ship.tier ?? 0}</span>
          {empireName && (
            <span className={styles.badge} style={{ color: empireColor(empire) }}>
              {empireName}
            </span>
          )}
          {ship.class && <span className={styles.badge}>{ship.class}</span>}
          {ship.category && <span className={styles.badge}>{ship.category}</span>}
          {prestige && <span className={styles.badge}>Achievement Unlock</span>}
          {ship.starter_ship && <span className={styles.badge}>Starter Ship</span>}
          {ship.npc_role && <span className={styles.badge}>Pirate {titleCase(ship.npc_role)}</span>}
          <span className={styles.badge}>{ship.id}</span>
        </div>
      </header>

      {hasArt(artID) && (
        <Image
          src={shipArtSrc(artID)}
          alt={ship.name}
          width={1200}
          height={900}
          className={styles.shipArt}
          priority
        />
      )}

      <Section title="Stats">
        <StatGrid stats={stats} />
      </Section>

      <Section title="Slots">
        <StatGrid stats={slots} />
      </Section>

      {ship.npc_role && (
        <Section title="Pirate Configuration">
          <p className={styles.lore}>
            NPC-operated {ship.npc_role} variant
            {sourceHull && ship.based_on ? (
              <>{' '}converted from the <Link href={`/codex/ships/${ship.based_on}`}>{sourceHull.name}</Link> hull.</>
            ) : '.'}
          </p>
        </Section>
      )}

      {capabilities.length > 0 && (
        <Section title="Inherent Capabilities">
          <StatGrid stats={capabilities} />
        </Section>
      )}

      {defaultModules.length > 0 && (
        <Section title="Default Loadout">
          <div className={styles.chipLinkRow}>
            {defaultModules.map((moduleId, i) => (
              <Link
                key={`${moduleId}-${i}`}
                href={`/codex/modules/${moduleId}`}
                className={styles.refItem}
              >
                {formatItemId(moduleId)}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {(piloting > 0 || prestige) && (
        <Section title="Requirements">
          {piloting > 0 && (
            <div className={styles.chipLinkRow}>
              <Link href="/codex/skills/piloting" className={styles.refItem}>
                Piloting Lv.{piloting}
              </Link>
            </div>
          )}
          {ship.prestige_lock && <p className={styles.emptyNote}>{ship.prestige_lock}</p>}
        </Section>
      )}

      {buildMaterials.length > 0 && (
        <Section title={`${ship.npc_role ? 'Pirate Refit Materials' : 'Build Materials'} (${buildMaterials.length})`}>
          <div className={styles.chipLinkRow}>
            {buildMaterials.map((mat) => (
              <Link key={mat.item_id} href={itemHref(mat.item_id)} className={styles.refItem}>
                {mat.quantity}x {formatItemId(mat.item_id)}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {ship.special && (
        <Section title="Special">
          <p className={styles.lore}>{titleCase(ship.special)}</p>
        </Section>
      )}

      {ship.lore && (
        <Section title="Lore">
          <p className={styles.lore}>{ship.lore}</p>
        </Section>
      )}

      {ship.flavor_tags && ship.flavor_tags.length > 0 && (
        <div className={styles.tagRow}>
          {ship.flavor_tags.map((tag) => (
            <span key={tag} className={styles.badge}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}
