import { useState } from 'react'

import type { TModerator } from '~/spec'
import Button from '~/ui/Buttons/Button'
import Drawer from '~/ui/Drawer'
import { toast } from '~/ui/Toaster'

import { expandAdminPermissions } from '../logic/adminPermissions'
import useAdmins from '../logic/useAdmins'
import PermissionChecklist from './PermissionChecklist'

type TProps = { item: TModerator; onClose: () => void }

export default function PermissionEditor({ item, onClose }: TProps) {
  const { grantablePermissions, updatePermissions, removeAdmin } = useAdmins()
  const [permissions, setPermissions] = useState<string[]>(item.permissions ?? [])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!item.memberId || item.revision === undefined) return
    setSaving(true)
    try {
      await updatePermissions(item.memberId, item.revision, expandAdminPermissions(permissions))
      onClose()
    } catch (error) {
      toast(String(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer show onClose={onClose} wide>
      <section className='space-y-4 p-6' aria-label='编辑管理员权限'>
        <h3 className='text-lg font-semibold'>编辑 @{item.user.login} 的权限</h3>
        <PermissionChecklist
          permissions={permissions}
          grantablePermissions={grantablePermissions}
          onChange={(permission, checked) =>
            setPermissions((current) =>
              checked
                ? [...new Set([...current, permission])]
                : current.filter((key) => key !== permission),
            )
          }
        />
        <div className='flex gap-2'>
          <Button loading={saving} onClick={() => void save()}>
            保存权限
          </Button>
          {!item.isLord ? (
            <Button
              ghost
              loading={saving}
              onClick={async () => {
                if (!item.memberId || item.revision === undefined) return
                setSaving(true)
                try {
                  await removeAdmin(item.memberId, item.revision)
                  onClose()
                } catch (error) {
                  toast(String(error), 'error')
                } finally {
                  setSaving(false)
                }
              }}
            >
              移除管理员
            </Button>
          ) : null}
          <Button ghost onClick={onClose}>
            关闭
          </Button>
        </div>
      </section>
    </Drawer>
  )
}
