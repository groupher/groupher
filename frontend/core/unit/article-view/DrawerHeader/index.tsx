import { useRouter } from 'next/navigation'

import ArrowSVG from '~/icons/Arrow'
import WarningSVG from '~/icons/Warning'
import ArticleSettingMenu from '~/unit/article-setting-menu'
import Share from '~/unit/share'
import useSalon, { cn } from '../salon/drawer_header'
import ArticleNavi from './ArticleNavi'

export default function DrawerHeader() {
  const s = useSalon()
  const router = useRouter()

  return (
    <div className={s.wrapper}>
      <button className={s.backBtn} onClick={() => router.back()}>
        <ArrowSVG className={s.icon} />
      </button>
      <div className='ml-1' />
      <ArticleNavi />
      <div className='grow' />
      <Share modalOffset='53%' />
      <div className={s.divider} />
      <div className={s.iconBoxRed}>
        <WarningSVG className={cn(s.iconRed, 'size-4')} />
      </div>
      <ArticleSettingMenu left={1} />
    </div>
  )
}
