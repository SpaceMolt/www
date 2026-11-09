'use client'

import { useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import type { FactionCreateRolePermissions, FactionInfoResponse } from '@spacemolt/lib'
import { useAccountStore } from '@/lib/spacemolt'
import { ActionButton } from '../../ActionButton'
import { ConfirmAction, shared } from '../../shared'
import styles from '../FactionPanel.module.css'
import { NO_PERMISSIONS, PERMISSION_LABELS } from './factionAdmin'
import { useRun } from './useRun'

type Role = NonNullable<FactionInfoResponse['roles']>[number]
const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as (keyof FactionCreateRolePermissions)[]

/** Create, edit and delete custom faction roles. Needs manage_roles; the server enforces it. */
export function RolesSection({ info, onChanged }: { info: FactionInfoResponse; onChanged: () => void }) {
  const store = useAccountStore()
  const { busy, run } = useRun()
  const [editing, setEditing] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('10')
  const [perms, setPerms] = useState<FactionCreateRolePermissions>(NO_PERMISSIONS)
  const [deleting, setDeleting] = useState<string | null>(null)
  const roles = [...(info.roles ?? [])].sort((a, b) => b.priority - a.priority)
  const admin = store.account.commands.spacemolt_faction_admin

  const startEdit = (role: Role | null) => {
    setEditing(role)
    setName(role?.name ?? '')
    setPriority(String(role?.priority ?? 10))
    setPerms(role?.permissions ?? NO_PERMISSIONS)
  }

  const save = async () => {
    const ok = editing
      ? await run('save', () => admin.edit_role({ role_id: editing.id, name: name.trim(), permissions: perms }), `Role ${name.trim()} updated`)
      : await run('save', () => admin.create_role({ name: name.trim(), priority: Number(priority), permissions: perms }), `Role ${name.trim()} created`)
    if (ok) {
      startEdit(null)
      onChanged()
    }
  }

  const remove = async (role: Role) => {
    setDeleting(null)
    if (await run(`delete:${role.id}`, () => store.account.commands.spacemolt_faction.delete_role({ id: role.id }), `Role ${role.name} deleted`)) onChanged()
  }

  return (
    <div className={styles.roomSection}>
      <div className={styles.memberList}>
        {roles.map((role) => (
          <div key={role.id} className={styles.memberItem}>
            <div className={styles.memberLeft}>
              <span className={styles.memberName}>{role.name}</span>
              <span className={styles.memberRole}>p{role.priority}</span>
            </div>
            {deleting === role.id ? (
              <ConfirmAction message={`Delete role ${role.name}?`} onConfirm={() => remove(role)} onCancel={() => setDeleting(null)} />
            ) : (
              <div className={styles.memberRight}>
                <span className={styles.intelMeta}>
                  {PERMISSION_KEYS.filter((k) => role.permissions[k]).map((k) => PERMISSION_LABELS[k]).join(', ') || 'no permissions'}
                </span>
                <button className={styles.kickBtn} onClick={() => startEdit(role)} title={`Edit ${role.name}`} aria-label={`Edit ${role.name}`} type="button">
                  <Pencil size={10} />
                </button>
                <button className={styles.kickBtn} onClick={() => setDeleting(role.id)} disabled={busy === `delete:${role.id}`} title={`Delete ${role.name}`} aria-label={`Delete ${role.name}`} type="button">
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.roomForm}>
        <div className={styles.roomFormTitle}>
          {editing ? <><Pencil size={12} /> Edit {editing.name}</> : <><Plus size={12} /> New Role</>}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quartermaster" />
        </div>
        {!editing && (
          <div className={styles.field}>
            <label className={styles.label}>Priority (higher outranks lower)</label>
            <input className={styles.input} type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
        )}
        <div className={styles.permissionGrid}>
          {PERMISSION_KEYS.map((k) => (
            <label key={k} className={styles.checkLabel}>
              <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} />
              {PERMISSION_LABELS[k]}
            </label>
          ))}
        </div>
        <div className={styles.formActions}>
          <ActionButton
            label={editing ? 'Save Role' : 'Create Role'}
            icon={<Save size={12} />}
            onClick={save}
            disabled={!name.trim() || (!editing && !(Number(priority) > 0))}
            loading={busy === 'save'}
            size="sm"
          />
          {editing && <button className={shared.subtleBtn} onClick={() => startEdit(null)} type="button">Cancel</button>}
        </div>
      </div>
    </div>
  )
}
