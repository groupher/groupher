/*
 *
 * ArticlesFilter
 *
 */

import BUTTON_PREFIX from '~/const/button_prefix'
import { COMMUNITY_LAYOUT } from '~/const/layout'
import { CONDITION_MODE, PUBLISH_MODE } from '~/const/mode'
import TYPE from '~/const/type'
import useArticlesFilter from '~/hooks/useArticlesFilter'
import useLayout from '~/hooks/useLayout'
import usePagedPosts from '~/hooks/usePagedPosts'
import { callGEditor, callSyncSelector } from '~/signal'
import type { TArticleCat, TArticleOrder, TArticleStatus, TSpace } from '~/spec'
import ConditionSelector from '~/unit/ConditionSelector'
import PublishButton from '~/widgets/Buttons/PublishButton'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import SearchBox from '~/widgets/SearchBox'

import useSalon from './salon'

type TProps = TSpace

export default function ArticlesFilter({ ...spacing }: TProps) {
  const s = useSalon({ ...spacing })

  const { resState } = usePagedPosts()
  const isLoading = resState === TYPE.RES_STATE.LOADING
  const { communityLayout } = useLayout()

  const {
    cat: activeCat,
    status: activeStatus,
    order: activeOrder,
    updateActiveFilter,
  } = useArticlesFilter()

  const renderSearchBox = () => {
    if (communityLayout === COMMUNITY_LAYOUT.SIDEBAR) {
      return isLoading ? <LavaLampLoading /> : <SearchBox />
    }

    if (communityLayout === COMMUNITY_LAYOUT.CLASSIC) {
      return isLoading ? <LavaLampLoading top={4} right={12} /> : <SearchBox right={-4} />
    }

    if (communityLayout === COMMUNITY_LAYOUT.HERO) {
      return isLoading ? <LavaLampLoading right={6} /> : <SearchBox right={6} />
    }

    return null
  }

  return (
    <div className={s.wrapper}>
      <ConditionSelector
        mode={CONDITION_MODE.ORDER}
        active={activeOrder}
        onSelect={(order: TArticleOrder) => {
          updateActiveFilter({ order })
        }}
        selected={!!activeOrder}
        prefixIcon={BUTTON_PREFIX.SORT}
        right={0.5}
      />
      <ConditionSelector
        mode={CONDITION_MODE.CAT}
        active={activeCat}
        onSelect={(cat: TArticleCat) => {
          updateActiveFilter({ cat })
        }}
        selected={!!activeCat}
        prefixIcon={BUTTON_PREFIX.CATEGORY}
        right={0.5}
      />
      <ConditionSelector
        mode={CONDITION_MODE.STATUS}
        active={activeStatus}
        onSelect={(status: TArticleStatus) => {
          updateActiveFilter({ status })
        }}
        selected={!!activeStatus}
        prefixIcon={BUTTON_PREFIX.STATUS}
      />
      <div className='mr-2.5' />
      <div className='grow' />
      {renderSearchBox()}
      {communityLayout === COMMUNITY_LAYOUT.SIDEBAR && (
        <PublishButton
          text='参与讨论'
          mode={PUBLISH_MODE.SIDEBAR_LAYOUT_HEADER}
          onMenuSelect={(cat) => {
            callGEditor()
            setTimeout(() => callSyncSelector({ cat }), 500)
          }}
          offset={[5, 5]}
          placement='bottom'
          top={-1}
        />
      )}
    </div>
  )
}
