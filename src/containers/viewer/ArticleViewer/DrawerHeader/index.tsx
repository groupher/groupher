import { closeDrawer } from '~/signal'

import ArrowSVG from '~/icons/Arrow'
import WarningSVG from '~/icons/Warning'

import Share from '~/widgets/Share'
import ArticleSettingMenu from '~/widgets/ArticleSettingMenu'

import ArticleNavi from './ArticleNavi'

import useSalon from '../styles/drawer_header'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.backBtn} onClick={() => closeDrawer()}>
        <ArrowSVG className={s.arrow} />
      </div>
      <div className="ml-1" />
      <ArticleNavi />
      <div className="grow" />
      <Share modalOffset="53%" />
      <div className="ml-4" />
      <WarningSVG className={s.arrow} />
      <ArticleSettingMenu left={16} />
    </div>
  )
}
