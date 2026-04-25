/*
 *
 * SearchPanel
 *
 */

import { type FC, lazy, memo, Suspense } from 'react'

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import CloseSVG from '~/icons/CloseLight'
import { closeDrawer } from '~/signal'
import Input from '~/widgets/Input'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon from './salon'

const FaqList = lazy(() => import('~/unit/FaqList'))

type TProps = {
  testid?: string
}

const SearchPanel: FC<TProps> = ({ _testid = 'search-panel' }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <CloseSVG onClick={() => closeDrawer()} className={s.closeIcon} />

      <div className={s.title}>在帖子中搜索</div>
      <Input placeholder='搜索内容' autoFocus />

      <Suspense fallback={<LavaLampLoading />}>
        <FaqList layout={DOC_FAQ_LAYOUT.SEARCH_HINT} top={8} left={6} />
      </Suspense>
    </div>
  )
}

export default memo(SearchPanel)
