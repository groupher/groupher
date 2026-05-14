/* *
 * PassportEditor
 *
 */

import { type FC, useState } from 'react'

import SIZE from '~/const/size'
import { SOCIAL_LIST } from '~/const/social'
import useMount from '~/hooks/useMount'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import type { TSocialItem, TSocialType, TUser } from '~/spec'
import AdminUserItem from '~/unit/DashboardThread/Admin/UserItem'
import SocialList from '~/unit/SocialList'
import Button from '~/widgets/Buttons/Button'
import ImgFallback from '~/widgets/ImgFallback'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import Modal from '~/widgets/Modal'

import useSalon from './salon'
import Selects from './Selects'
import useLogic from './useLogic'

const userSocialItems = (user: TUser): TSocialItem[] => {
  const { social } = user
  if (!social) return []

  const items: Array<{ type: TSocialType; link?: string }> = [
    { type: SOCIAL_LIST.GITHUB, link: social.github },
    { type: SOCIAL_LIST.TWITTER, link: social.twitter },
    { type: SOCIAL_LIST.ZHIHU, link: social.zhihu },
  ]

  return items.filter((item): item is TSocialItem => Boolean(item.link))
}

const PassportEditor: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    activeModerator,
    allRootRules,
    allModeratorRules,
    selectedGlobalRules,
    selectedRules,
    loadAllPassportRules,
    updatePassport,
    deleteModerator,
    isActiveModeratorRoot,
    isActiveModeratorGod,
    isReadonly,
    loading,
    toggleCheck,
  } = useLogic()

  useMount(loadAllPassportRules)

  if (!activeModerator) return null

  return (
    <div className={s.wrapper}>
      <div className={s.profile}>
        <Img
          className={s.avatar}
          src={activeModerator.avatar}
          fallback={<ImgFallback user={activeModerator} className={s.avatar} size={SIZE.MEDIUM} />}
          noLazy
        />
        <div className={s.profileIntro}>
          <div className={s.profileHeader}>
            <div className={s.nickname}>{activeModerator.nickname}</div>
            <div className={s.login}>@{activeModerator.login}</div>
            {isActiveModeratorRoot ? <div className={s.rootSign}>root</div> : null}
          </div>
          {activeModerator.bio ? <p className={s.bio}>{activeModerator.bio}</p> : null}
          <SocialList selected={userSocialItems(activeModerator)} top={8} left={-10} size='tiny' />
        </div>
      </div>
      {loading ? (
        <div className={s.loading}>
          <LavaLampLoading />
        </div>
      ) : (
        <Selects
          allRootRules={allRootRules}
          allModeratorRules={allModeratorRules}
          selectedGlobalRules={selectedGlobalRules}
          selectedRules={selectedRules}
          isReadonly={isReadonly}
          isActiveModeratorRoot={isActiveModeratorRoot}
          isActiveModeratorGod={isActiveModeratorGod}
          toggleCheck={toggleCheck}
        />
      )}

      {!loading && !isReadonly && (
        <div className={s.footer}>
          <Button noBorder onClick={() => updatePassport()}>
            {t('passport.action.update_rules')}
          </Button>
          <Button red ghost noBorder onClick={() => setShowDeleteConfirm(true)}>
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
                user: activeModerator,
                isRoot: isActiveModeratorRoot,
                passportItemCount: selectedGlobalRules.length + selectedRules.length,
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
