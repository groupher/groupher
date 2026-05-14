import { ADMIN_ROLE } from '~/const/dashboard'
import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TModerator, TSimpleUser } from '~/spec'
import AdminAvatar from '~/unit/AdminAvatar'
import Button from '~/widgets/Buttons/Button'

import useSalon from './salon/user_item'

type TProps = {
  item: TModerator
  active?: boolean
  readonly?: boolean
  onOpen?: (user: TSimpleUser) => void
}

const UserItem = ({ item, active = false, readonly = false, onOpen }: TProps) => {
  const s = useSalon()
  const { t } = useTrans()
  const { user, passportItemCount, role } = item

  if (!user?.login) return null

  const permissionsLabel =
    role === ADMIN_ROLE.ROOT ? (
      <>{t('dsb.admin.list.all_permissions')}</>
    ) : (
      <>
        {passportItemCount} {t('dsb.admin.list.permissions_unit')}
      </>
    )

  return (
    <div className={cn(s.wrapper, active && s.wrapperActive, readonly && s.wrapperReadonly)}>
      <AdminAvatar user={user} right={5} />
      <div className={s.intro}>
        <div className={s.header}>
          <div className={s.name}>{user.nickname}</div>
          <div className={s.login}>@{user.login}</div>
          {role === ADMIN_ROLE.ROOT && <div className={s.rootSign}>{ADMIN_ROLE.ROOT}</div>}
          {item.pending && <div className={s.pendingSign}>{t('dsb.admin.badge.pending')}</div>}
          <div className='grow' />
          {readonly ? (
            <div className={s.readonlyPermission}>{permissionsLabel}</div>
          ) : (
            <Button top={1} onClick={() => onOpen?.(user)} ghost noBorder size='small'>
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
