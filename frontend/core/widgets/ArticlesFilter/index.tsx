/*
 *
 * ArticlesFilter
 *
 */

import { BANNER_LAYOUT } from '~/const/layout'
import { CONDITION_MODE } from '~/const/mode'
import { PUBLISH_MODE } from '~/const/publish'
import TYPE from '~/const/type'
import useArticlesFilter from '~/hooks/useArticlesFilter'
import useLayout from '~/hooks/useLayout'

import usePagedPosts from '~/hooks/usePagedPosts'
import { callGEditor, callSyncSelector, refreshArticles } from '~/signal'
import type { TArticleCat, TArticleOrder, TArticleState } from '~/spec'

import PublishButton from '~/widgets/Buttons/PublishButton'
import ConditionSelector from '~/widgets/ConditionSelector'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import SearchBox from '~/widgets/SearchBox'

import useSalon from './salon'

export default () => {
  const s = useSalon()

  const { resState } = usePagedPosts()
  const { bannerLayout } = useLayout()

  const {
    cat: activeCat,
    state: activeState,
    order: activeOrder,
    updateActiveFilter,
  } = useArticlesFilter()

  return (
    <div className={s.wrapper}>
      <ConditionSelector
        mode={CONDITION_MODE.ORDER}
        active={activeOrder}
        onSelect={(order: TArticleOrder) => {
          updateActiveFilter({ order })
          refreshArticles()
        }}
        selected={!!activeOrder}
        prefixIcon='sort'
        right={0.5}
      />
      <ConditionSelector
        mode={CONDITION_MODE.CAT}
        active={activeCat}
        onSelect={(cat: TArticleCat) => {
          updateActiveFilter({ cat })
          refreshArticles()
        }}
        selected={!!activeCat}
        prefixIcon='catetory'
        right={0.5}
      />
      <ConditionSelector
        mode={CONDITION_MODE.STATE}
        active={activeState}
        onSelect={(state: TArticleState) => {
          updateActiveFilter({ state })
          refreshArticles()
        }}
        selected={!!activeState}
        prefixIcon='status'
      />
      <div className='mr-2.5' />
      <div className='grow' />
      {resState === TYPE.RES_STATE.LOADING && <LavaLampLoading right={28} left={10} />}
      {bannerLayout === BANNER_LAYOUT.SIDEBAR && <SearchBox />}
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
      {bannerLayout === BANNER_LAYOUT.HEADER && <SearchBox right={-2} />}
      {bannerLayout === BANNER_LAYOUT.TABBER && <SearchBox right={6} />}
    </div>
  )
}
