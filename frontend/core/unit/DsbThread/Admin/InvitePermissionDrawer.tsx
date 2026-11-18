import useTrans from '~/hooks/useTrans'
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
  const { t } = useTrans()

  return (
    <Drawer show={show} onClose={onClose} wide>
      <section className='space-y-4 p-6' aria-label={t('dsb.admin.invite.permissions.title')}>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold'>{t('dsb.admin.invite.permissions.title')}</h3>
          <p className='text-sm opacity-70'>{t('dsb.admin.invite.permissions.description')}</p>
        </div>
        <PermissionChecklist
          permissions={permissions}
          grantablePermissions={grantablePermissions}
          onChange={onChange}
        />
        <div className='flex justify-end'>
          <Button onClick={onClose}>{t('dsb.admin.invite.permissions.done')}</Button>
        </div>
      </section>
    </Drawer>
  )
}
