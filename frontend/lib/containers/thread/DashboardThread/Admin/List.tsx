import { callPassportEditor } from '~/signal'

import ArrowSVG from '~/icons/ArrowSimple'

import Button from '~/widgets/Buttons/Button'
import AdminAvatar from '~/widgets/AdminAvatar'

import useAdmins from '../logic/useAdmins'

import useSalon, { cn } from '../salon/admin/list'

export default () => {
  const s = useSalon()
  const { getModerators, activeModerator, setActiveSettingAdmin } = useAdmins()

  const moderators = getModerators()

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
                <div className="grow" />
                <Button
                  top={1}
                  className="w-28"
                  onClick={() => {
                    setActiveSettingAdmin(user)
                    callPassportEditor()
                  }}
                  ghost
                  noBorder
                  size="small"
                >
                  {role === 'root' ? <>全部权限</> : <>{passportItemCount} 项权限</>}
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
