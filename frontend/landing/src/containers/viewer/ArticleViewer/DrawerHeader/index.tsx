import { closeDrawer } from '~/signal'

import ArrowSVG from '~/icons/Arrow'
import WarningSVG from '~/icons/Warning'

import Share from '~/widgets/Share'
import ArticleSettingMenu from '~/widgets/ArticleSettingMenu'

import ArticleNavi from './ArticleNavi'

import useSalon, { cn } from '../salon/drawer_header'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.backBtn} onClick={() => closeDrawer()}>
        <ArrowSVG className={s.icon} />
      </div>
      <div className="ml-1" />
      <ArticleNavi />
      <div className="grow" />
      <Share modalOffset="53%" />
      <div className={s.divider} />
      <div className={s.iconBoxRed}>
        <WarningSVG className={cn(s.iconRed, 'size-4')} />
      </div>
      <ArticleSettingMenu left={1} />
    </div>
  )
}
