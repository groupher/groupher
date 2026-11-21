/* *
 * PassportEditor
 *
 */

import { type FC, useState } from 'react'

import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import Button from '~/ui/Buttons/Button'
import ImgFallback from '~/ui/ImgFallback'
import Modal from '~/ui/Modal'
import PermissionChecklist from '~/unit/DsbThread/Admin/PermissionChecklist'
import AdminUserItem from '~/unit/DsbThread/Admin/UserItem'

import useSalon from './salon'
import useLogic from './useLogic'

const PassportEditor: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    activeModerator,
    grantablePermissions,
    selectedPermissions,
    updatePassport,
    deleteModerator,
    isActiveModeratorRoot,
    isReadonly,
    saving,
    toggleCheck,
  } = useLogic()

  if (!activeModerator) return null
  const { user } = activeModerator

  return (
    <div className={s.wrapper}>
      <div className={s.profile}>
        <Img
          className={s.avatar}
          src={user.avatar ?? ''}
          fallback={<ImgFallback user={user} className={s.avatar} size={SIZE.MEDIUM} />}
          noLazy
        />
        <div className={s.profileIntro}>
          <div className={s.profileHeader}>
            <div className={s.nickname}>{user.nickname}</div>
            <div className={s.login}>@{user.login}</div>
            {isActiveModeratorRoot ? <div className={s.rootSign}>Lord</div> : null}
          </div>
          {user.bio ? <p className={s.bio}>{user.bio}</p> : null}
        </div>
      </div>
      <PermissionChecklist
        permissions={selectedPermissions}
        grantablePermissions={grantablePermissions}
        onChange={toggleCheck}
      />

      {!isReadonly && (
        <div className={s.footer}>
          <Button loading={saving} noBorder onClick={() => updatePassport()}>
            {t('passport.action.update_rules')}
          </Button>
          <Button red ghost noBorder disabled={saving} onClick={() => setShowDeleteConfirm(true)}>
            {t('passport.action.delete')}
          </Button>
        </div>
      )}

      <Modal
        show={showDeleteConfirm}
        width='360px'
        offsetLeft='40%'
        compact
        showCloseBtn
        onClose={() => setShowDeleteConfirm(false)}
      >
        <div className={s.deleteModal}>
          <h3 className={s.deleteTitle}>{t('passport.delete_modal.title')}</h3>
          <div className={s.deleteBox}>
            <AdminUserItem
              item={{
                ...activeModerator,
              }}
              readonly
            />
          </div>
          <p className={s.deleteDesc}>{t('passport.delete_modal.desc')}</p>
          <div className={s.deleteActions}>
            <Button ghost noBorder onClick={() => setShowDeleteConfirm(false)}>
              {t('passport.action.cancel')}
            </Button>
            <Button
              red
              loading={saving}
              onClick={() => {
                setShowDeleteConfirm(false)
                deleteModerator()
              }}
            >
              {t('passport.action.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PassportEditor
