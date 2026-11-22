import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TModerator } from '~/spec'
import Button from '~/ui/Buttons/Button'
import AdminAvatar from '~/unit/AdminAvatar'

import useSalon from './salon/user_item'

type TProps = {
  item: TModerator
  active?: boolean
  readonly?: boolean
  onOpen?: () => void
}

const UserItem = ({ item, active = false, readonly = false, onOpen }: TProps) => {
  const s = useSalon()
  const { t } = useTrans()
  const { user, permissions, isLord } = item
  if (!user?.login) return null

  const permissionsLabel = isLord ? (
    <>{t('dsb.admin.list.all_permissions')}</>
  ) : (
    <>
      {permissions.length} {t('dsb.admin.list.permissions_unit')}
    </>
  )

  return (
    <div className={cn(s.wrapper, active && s.wrapperActive, readonly && s.wrapperReadonly)}>
      <AdminAvatar user={user} right={5} />
      <div className={s.intro}>
        <div className={s.header}>
          <div className={s.name}>{user.nickname}</div>
          <div className={s.login}>@{user.login}</div>
          {isLord && <div className={s.rootSign}>Lord</div>}
          <div className='grow' />
          {readonly ? (
            <div className={s.readonlyPermission}>{permissionsLabel}</div>
          ) : (
            <Button top={1} onClick={onOpen} ghost noBorder size='small'>
              {permissionsLabel}
              <ArrowSVG className={s.arrowIcon} />
            </Button>
          )}
        </div>
        <p className={s.bio}>{user.bio}</p>
      </div>
    </div>
  )
}

export default UserItem
