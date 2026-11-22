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
  const { slug, ref } = useCommunity()
  const { can } = useGate({ community: { slug, ref: ref ?? '' } })
  const { activeAdmin, updatePermissions, removeAdmin } = useAdmins()
  const [draft, setDraft] = useState<{ memberId: string; permissions: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const selectedPermissions =
    draft && draft.memberId === activeAdmin?.memberId
      ? draft.permissions
      : (activeAdmin?.permissions ?? [])
  const canManage = can(GATE_ACTION.ADMIN_PERMISSIONS_UPDATE, {
    scope: 'community',
    community: slug,
  })
  const isReadonly = !canManage || !activeAdmin || activeAdmin.isLord

  const run = async (remove: boolean): Promise<void> => {
    if (!activeAdmin || isReadonly) return
    setSaving(true)
    try {
      if (remove) {
        await removeAdmin(activeAdmin.memberId, activeAdmin.revision)
      } else {
        await updatePermissions(
          activeAdmin.memberId,
          activeAdmin.revision,
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
    activeAdmin,
    selectedPermissions,
    grantablePermissions: Object.entries(GATE_PERMISSION)
      .filter(([, permission]) => permission.scope === 'community' && permission.grantable)
      .map(([action]) => action),
    toggleCheck: (permission: string, checked: boolean): void => {
      if (!activeAdmin) return
      setDraft({
        memberId: activeAdmin.memberId,
        permissions: checked
          ? [...new Set([...selectedPermissions, permission])]
          : selectedPermissions.filter((item) => item !== permission),
      })
    },
    updatePassport: () => void run(false),
    deleteAdmin: () => void run(true),
    isActiveAdminLord: activeAdmin?.isLord === true,
    isReadonly,
    saving,
  }
}
