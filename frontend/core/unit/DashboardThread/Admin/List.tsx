import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import { callPassportEditor } from '~/signal'
import AdminAvatar from '~/unit/AdminAvatar'
import Button from '~/widgets/Buttons/Button'

import useAdmins from '../logic/useAdmins'

import useSalon, { cn } from '../salon/admin/list'

export default function List() {
  const s = useSalon()
  const { moderators, activeModerator, setActiveSettingAdmin } = useAdmins()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      {moderators.map((item) => {
        const { user, passportItemCount, role } = item
        const active = user.login === activeModerator?.login

        return (
          <div key={user.login} className={cn(s.user, active && s.userActive)}>
            <AdminAvatar user={user} right={5} top={3} />
            <div className={s.intro}>
              <div className={s.header}>
                <div className={s.name}>{user.nickname}</div>
                <div className={s.login}>@{user.login}</div>
                {role === 'root' && <div className={s.rootSign}>root</div>}
                <div className='grow' />
                <Button
                  top={1}
                  onClick={() => {
                    setActiveSettingAdmin(user)
                    callPassportEditor()
                  }}
                  ghost
                  noBorder
                  size='small'
                >
                  {role === 'root' ? (
                    <>{t('dsb.admin.list.all_permissions')}</>
                  ) : (
                    <>
                      {passportItemCount} {t('dsb.admin.list.permissions_unit')}
                    </>
                  )}
                  <ArrowSVG className={s.arrowIcon} />
                </Button>
              </div>
              <p className={s.bio}>{user.bio}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
