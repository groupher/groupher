import Button from '~/ui/Buttons/Button'
import Drawer from '~/ui/Drawer'

import PermissionChecklist from './PermissionChecklist'

type TProps = {
  show: boolean
  permissions: string[]
  grantablePermissions: string[]
  onChange: (permission: string, checked: boolean) => void
  onClose: () => void
}

export default function InvitePermissionDrawer({
  show,
  permissions,
  grantablePermissions,
  onChange,
  onClose,
}: TProps) {
  return (
    <Drawer show={show} onClose={onClose} wide>
      <section className='space-y-4 p-6' aria-label='邀请管理员权限'>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold'>邀请管理员权限</h3>
          <p className='text-sm opacity-70'>选择新管理员可使用的社区权限。</p>
        </div>
        <PermissionChecklist
          permissions={permissions}
          grantablePermissions={grantablePermissions}
          onChange={onChange}
        />
        <div className='flex justify-end'>
          <Button onClick={onClose}>完成</Button>
        </div>
      </section>
    </Drawer>
  )
}
