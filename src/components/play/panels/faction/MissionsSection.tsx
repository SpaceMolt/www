'use client'

import { useState } from 'react'
import { Plus, Send, Trash2, X } from 'lucide-react'
import { useCommandMutation, useCommandQuery, useLocationState } from '@/lib/spacemolt'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, Credits, Loading, objectKey, shared, useAction } from '../../shared'
import styles from '../FactionPanel.module.css'
import {
  MISSION_TYPES, OBJECTIVE_TYPES, TARGET_FIELD, buildMissionParams,
  type MissionDraft, type ObjectiveDraft,
} from './factionAdmin'
import { useFactionService } from './useFactionService'

const EMPTY_OBJECTIVE: ObjectiveDraft = { type: 'deliver_item', description: '', item_id: '', quantity: '', target: '' }
const EMPTY_DRAFT: MissionDraft = {
  title: '', description: '', type: 'delivery', objectives: [], credits: '', expirationHours: '', openToAll: false,
}
const TARGET_HINT: Record<(typeof TARGET_FIELD)[ObjectiveDraft['type']], string> = {
  target_base_id: 'Target base id (blank = this station)',
  target_id: 'Target pilot username',
  system_id: 'System id',
  pirate_tier: 'Pirate tier (optional)',
}

/**
 * Faction missions posted at the docked station (the parent shows it only docked): list, and with
 * manage_treasury (`canManage`) cancel, plus post where a faction_missions facility is here.
 * Rewards are escrowed from faction storage.
 */
export function MissionsSection({ canManage }: { canManage: boolean }) {
  const mutate = useCommandMutation()
  const dockedAt = useLocationState()?.docked_at ?? null
  const { busy, run } = useAction()
  const hasBoard = useFactionService('faction_missions')
  const [draft, setDraft] = useState<MissionDraft>(EMPTY_DRAFT)
  const [objective, setObjective] = useState<ObjectiveDraft>(EMPTY_OBJECTIVE)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const { data, loading, error, refetch } = useCommandQuery(
    async (account) => (await account.commands.spacemolt_faction.list_missions()).structuredContent,
    [dockedAt],
    { enabled: Boolean(dockedAt) },
  )

  // A filled-in objective row counts even if "Add" was not pressed.
  const objectives = objective.description.trim() || objective.item_id.trim() || objective.target.trim()
    ? [...draft.objectives, objective]
    : draft.objectives

  const cancel = async (templateId: string) => {
    setCancelling(null)
    if (await run(`cancel:${templateId}`, () => mutate((c) => c.spacemolt_faction.cancel_mission({ id: templateId }), { label: 'faction_cancel_mission' }), 'Mission cancelled; escrow refunded', 'toast')) refetch()
  }

  const post = async () => {
    const params = buildMissionParams({ ...draft, objectives })
    if (await run('post', () => mutate((c) => c.spacemolt_faction_admin.post_mission(params), { label: 'faction_post_mission' }), `Posted ${params.title}`, 'toast')) {
      setDraft(EMPTY_DRAFT)
      setObjective(EMPTY_OBJECTIVE)
      refetch()
    }
  }

  return (
    <div className={styles.roomSection}>
      {loading && !data && <Loading message="Loading missions..." />}
      {error && <div className={shared.emptyState}>{error}</div>}
      {data && (
        <>
          <div className={styles.intelMeta}>
            {canManage && hasBoard === false
              ? 'Posting missions needs a Notice Board at this station. Build one from Facilities.'
              : `${data.count}/${data.max_posted} posted here`}
          </div>
          <div className={styles.roomList}>
            {data.missions.map((m) => (
              <div key={m.template_id} className={styles.roomItem}>
                <div className={styles.roomItemInfo}>
                  <span className={styles.roomItemName}>{m.title}</span>
                  <span className={styles.roomItemMeta}>
                    {m.type} -- <Credits amount={m.reward_credits} /> -- {m.active_instances} active{m.posted_by ? ` -- ${m.posted_by}` : ''}
                  </span>
                </div>
                {!canManage ? null : cancelling === m.template_id ? (
                  <ConfirmAction message="Cancel and refund?" onConfirm={() => cancel(m.template_id)} onCancel={() => setCancelling(null)} />
                ) : (
                  <ActionButton label="Cancel" icon={<Trash2 size={12} />} onClick={() => setCancelling(m.template_id)} loading={busy === `cancel:${m.template_id}`} variant="danger" size="sm" />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {canManage && hasBoard && (
        <div className={styles.roomForm}>
          <div className={styles.roomFormTitle}><Plus size={12} /> Post Mission</div>
          <input className={styles.input} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea className={styles.textarea} rows={2} placeholder="What does your faction need?" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <div className={styles.diplomacyRow}>
            <select className={styles.select} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as MissionDraft['type'] })} aria-label="Mission type">
              {MISSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={styles.input} type="number" min={0} placeholder="Reward credits" value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: e.target.value })} />
            <input className={styles.input} type="number" min={1} max={720} placeholder="Hours (72)" value={draft.expirationHours} onChange={(e) => setDraft({ ...draft, expirationHours: e.target.value })} />
          </div>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={draft.openToAll} onChange={(e) => setDraft({ ...draft, openToAll: e.target.checked })} />
            Open to non-members
          </label>

          <div className={styles.label}>Objectives</div>
          {draft.objectives.map((o, i) => (
            <div key={objectKey(o)} className={styles.intelItem}>
              <span className={styles.intelSystemName}>{o.type}</span>
              <span className={styles.intelMeta}>{[o.description, o.item_id, o.quantity, o.target].filter(Boolean).join(' / ')}</span>
              <button className={styles.kickBtn} onClick={() => setDraft({ ...draft, objectives: draft.objectives.filter((_, j) => j !== i) })} aria-label="Remove objective" type="button">
                <X size={10} />
              </button>
            </div>
          ))}
          <div className={styles.diplomacyRow}>
            <select className={styles.select} value={objective.type} onChange={(e) => setObjective({ ...objective, type: e.target.value as ObjectiveDraft['type'] })} aria-label="Objective type">
              {OBJECTIVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={styles.input} placeholder="Objective description" value={objective.description} onChange={(e) => setObjective({ ...objective, description: e.target.value })} />
          </div>
          <div className={styles.diplomacyRow}>
            <input className={styles.input} placeholder="Item id" value={objective.item_id} onChange={(e) => setObjective({ ...objective, item_id: e.target.value })} />
            <input className={styles.input} type="number" min={1} placeholder="Qty" value={objective.quantity} onChange={(e) => setObjective({ ...objective, quantity: e.target.value })} />
            <input className={styles.input} placeholder={TARGET_HINT[TARGET_FIELD[objective.type]]} value={objective.target} onChange={(e) => setObjective({ ...objective, target: e.target.value })} />
          </div>
          <div className={styles.formActions}>
            <ActionButton label="Add Objective" icon={<Plus size={12} />} onClick={() => { setDraft({ ...draft, objectives }); setObjective(EMPTY_OBJECTIVE) }} variant="secondary" size="sm" />
            <ActionButton
              label="Post Mission"
              icon={<Send size={12} />}
              onClick={post}
              disabled={!draft.title.trim() || !draft.description.trim() || objectives.length === 0}
              loading={busy === 'post'}
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
