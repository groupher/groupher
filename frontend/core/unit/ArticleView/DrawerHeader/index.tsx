import { useRouter } from 'next/navigation'
import { lazy, Suspense } from 'react'

import ArrowSVG from '~/icons/Arrow'
import WarningSVG from '~/icons/Warning'
import ArticleSettingMenu from '~/unit/ArticleSettingMenu'

import ArticleNavi from './ArticleNavi'
import useSalon, { cn } from './salon'

const Share = lazy(() => import('~/unit/Share'))

export default function DrawerHeader() {
  const s = useSalon()
  const { back } = useRouter()

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.backBtn} onClick={() => back()}>
        <ArrowSVG className={s.icon} />
      </button>
      <div className='ml-1' />
      <ArticleNavi />
      <div className='grow' />
      <Suspense fallback={null}>
        <Share modalOffset='53%' />
      </Suspense>
      <div className={s.divider} />
      <div className={s.iconBoxRed}>
        <WarningSVG className={cn(s.iconRed, 'size-4')} />
      </div>
      <ArticleSettingMenu left={1} />
    </div>
  )
}
