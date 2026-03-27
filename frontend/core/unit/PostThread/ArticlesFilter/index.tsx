/*
 *
 * ArticlesFilter
 *
 */

import BUTTON_PREFIX from '~/const/button_prefix'
import { BANNER_LAYOUT } from '~/const/layout'
import { CONDITION_MODE, PUBLISH_MODE } from '~/const/mode'
import TYPE from '~/const/type'
import useArticlesFilter from '~/hooks/useArticlesFilter'
import useLayout from '~/hooks/useLayout'

import usePagedPosts from '~/hooks/usePagedPosts'
import { callGEditor, callSyncSelector } from '~/signal'
import type { TArticleCat, TArticleOrder, TArticleState, TSpace } from '~/spec'
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
  const { bannerLayout } = useLayout()

  const {
    cat: activeCat,
    state: activeState,
    order: activeOrder,
    updateActiveFilter,
  } = useArticlesFilter()

  const renderSearchBox = () => {
    if (bannerLayout === BANNER_LAYOUT.SIDEBAR) {
      return isLoading ? <LavaLampLoading /> : <SearchBox />
    }

    if (bannerLayout === BANNER_LAYOUT.HEADER) {
      return isLoading ? <LavaLampLoading top={4} right={12} /> : <SearchBox right={-4} />
    }

    if (bannerLayout === BANNER_LAYOUT.TABBER) {
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
        mode={CONDITION_MODE.STATE}
        active={activeState}
        onSelect={(state: TArticleState) => {
          updateActiveFilter({ state })
        }}
        selected={!!activeState}
        prefixIcon={BUTTON_PREFIX.STATUS}
      />
      <div className='mr-2.5' />
      <div className='grow' />
      {renderSearchBox()}
      {bannerLayout === BANNER_LAYOUT.SIDEBAR && (
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
