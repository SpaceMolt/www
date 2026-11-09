'use client'

import shared from './shared.module.css'
import styles from './HUD.module.css'

/**
 * Controls the client hides until the player qualifies, and how to unlock each one.
 * Keep in step with the gates in hooks/useGates.ts and panels/faction/useFactionService.ts.
 */
const GROUPS: { title: string; note: string; items: [feature: string, unlock: string][] }[] = [
  {
    title: 'Station services',
    note: 'Dock at a station that offers the service.',
    items: [
      ['Shipyard', 'Buy, sell and switch ships. Needs a shipyard.'],
      ['Crafting', 'Craft items. Needs a crafting service.'],
      ['Market', 'Buy and sell on the station market. Needs a market. Without it, Trading shows your orders only.'],
      ['Storage', 'Store items, send gifts and fill buy orders into storage. Needs storage.'],
      ['Missions', 'Take missions and shipping hauls. Needs a missions board.'],
      ['Refuel and repair', 'Needs a refuel or repair service. You can also use fuel cells or repair kits from your cargo.'],
      ['Salvage tab (docked)', 'Sell or scrap a towed wreck. Needs a salvage yard. In space or while towing, the tab always shows.'],
      ['Station infirmary', 'Treat injured crew for credits. Needs a medical service.'],
      ['Recruit crew', 'Needs a personnel service.'],
      ['Recruit marines', 'Needs marine training.'],
    ],
  },
  {
    title: 'Ship loadout',
    note: 'Fit the module, or fly a hull that has it built in.',
    items: [
      ['Cloak', 'Hide in combat. Fit a cloaking device, or fly a hull with an integrated cloak.'],
      ['Survey system', 'Fit a survey scanner or anomaly detector, use a survey buff item, or fly a hull with an integrated scanner.'],
      ['Mine ore', 'Fit a mining laser.'],
      ['Mine ice, gas or radioactives', 'Fit an Ice, Gas or Rad Harvester. Some hulls can harvest radioactives.'],
      ['Tow wrecks', 'Fit a tow rig. A tow rig or a ship bay also lets you load a stored ship.'],
      ['Scrap wrecks in space', 'Fit the Outer Rim salvage array.'],
      ['Refuel other pilots', 'Fit a refueling pump. They must be at your location.'],
      ['Repair other pilots', 'Fit a repair arm and carry repair kits.'],
      ['Field medical care', 'Fit a medical module. Uses medical supplies from cargo.'],
      ['Field generator', 'Fit a generator module, have fit crew aboard, and dock.'],
    ],
  },
  {
    title: 'Faction membership',
    note: 'Join or create a faction.',
    items: [
      ['Faction chat', 'Talk to your faction.'],
      ['Faction storage', 'Send mined cargo and captured prizes to the faction.'],
      ['Faction achievements', 'Shown in the Info tab.'],
    ],
  },
  {
    title: 'Faction facilities at this station',
    note: 'Your faction must run the facility at the station you are docked at.',
    items: [
      ['Faction lockbox', 'Use faction storage here.'],
      ['Faction garage', 'Use the faction ship garage.'],
      ['Faction commons', 'Use the faction rooms.'],
      ['Company store', 'Use the faction company store.'],
      ['Faction market', 'Place market orders for the faction. Also needs storage and the treasury permission.'],
      ['Notice board', 'Post faction missions. Also needs the treasury permission.'],
      ['Faction desk', 'Edit faction details.'],
      ['Intel facilities', 'An intel terminal, trade ledger, sensor dome or espionage HQ unlocks its intel tools. Allies can share theirs.'],
    ],
  },
  {
    title: 'Faction role permissions',
    note: 'Your faction role must grant the permission. Ask a leader.',
    items: [
      ['invite', 'Invite players.'],
      ['kick', 'Remove members.'],
      ['promote', 'Change member roles.'],
      ['manage_roles', 'Create and edit roles.'],
      ['manage_diplomacy', 'Ally, declare war and make peace.'],
      ['manage_bases', 'Manage faction stations.'],
      ['manage_treasury', 'Spend faction credits: pay bounties, post missions, use the crew reserve. Withdraw from or craft with faction storage.'],
      ['manage_facilities', 'Build and manage faction facilities and rooms.'],
    ],
  },
]

export function FeatureHelp() {
  return (
    <>
      <p className={styles.unlockNote}>Some controls stay hidden until you can use them here.</p>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className={shared.sectionTitle}>{g.title}</h3>
          <p className={styles.unlockNote}>{g.note}</p>
          <dl className={styles.helpList}>
            {g.items.map(([feature, unlock]) => (
              <div key={feature}><dt className={styles.unlockFeature}>{feature}</dt><dd>{unlock}</dd></div>
            ))}
          </dl>
        </section>
      ))}
    </>
  )
}
