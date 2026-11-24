import { GATE_ACTION, GATE_PERMISSION } from '@groupher/contracts/gate'
import { useState } from 'react'

import useGate from '~/hooks/useGate'
import { closeDrawer } from '~/signal'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'

import { expandAdminPermissions } from '../DsbThread/logic/adminPermissions'
import useAdmins from '../DsbThread/logic/useAdmins'

/** Owns a revision-bound permission draft for the selected Admin membership. */
export default function useLogic() {
  const { slug } = useCommunity()
  const { can } = useGate()
  const { activeModerator, updatePermissions, removeAdmin } = useAdmins()
  const [draft, setDraft] = useState<{ memberId: string; permissions: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const selectedPermissions =
    draft && draft.memberId === activeModerator?.memberId
      ? draft.permissions
      : (activeModerator?.permissions ?? [])
  const canManage = can(GATE_ACTION.ADMIN_PERMISSIONS_UPDATE, {
    scope: 'community',
    community: slug,
  })
  const isReadonly = !canManage || !activeModerator || activeModerator.isLord

  const run = async (remove: boolean): Promise<void> => {
    if (!activeModerator || isReadonly) return
    setSaving(true)
    try {
      if (remove) {
        await removeAdmin(activeModerator.memberId, activeModerator.revision)
      } else {
        await updatePermissions(
          activeModerator.memberId,
          activeModerator.revision,
          expandAdminPermissions(selectedPermissions),
        )
      }
      closeDrawer()
    } catch (error) {
      toast(String(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  return {
    activeModerator,
    selectedPermissions,
    grantablePermissions: Object.entries(GATE_PERMISSION)
      .filter(([, permission]) => permission.scope === 'community' && permission.grantable)
      .map(([action]) => action),
    toggleCheck: (permission: string, checked: boolean): void => {
      if (!activeModerator) return
      setDraft({
        memberId: activeModerator.memberId,
        permissions: checked
          ? [...new Set([...selectedPermissions, permission])]
          : selectedPermissions.filter((item) => item !== permission),
      })
    },
    updatePassport: () => void run(false),
    deleteModerator: () => void run(true),
    isActiveModeratorRoot: activeModerator?.isLord === true,
    isReadonly,
    saving,
  }
}
