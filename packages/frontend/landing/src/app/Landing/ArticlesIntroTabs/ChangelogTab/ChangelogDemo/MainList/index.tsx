import { COLOR_NAME } from '~/const/colors'

import TagNode from '~/widgets/TagNode'

import StarSVG from '../../../../salon/articles_intro_tabs/changelog_tab/Star'

import CoverPreview from '../CoverPreview'
import Footer from './Footer'

import useSalon, {
  cn,
} from '../../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/main_list'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <StarSVG className={cn(s.starIcon, s.starOrange, 'top-32 left-8')} />
      <StarSVG className={cn(s.starIcon, s.starRed, 'top-32 right-32 opacity-60')} />
      <StarSVG className={cn(s.starIcon, s.starOrange, 'top-40 left-20 opacity-60')} />
      <div className={s.header}>
        <div className={s.title}>
          船新封面图编辑器 <div className={s.version}>v2.0</div>
        </div>

        <div className={s.tags}>
          <div className={s.tagItem}>
            <TagNode color={COLOR_NAME.GREEN} boldHash />
            Web
          </div>

          <div className={s.tagItem}>
            <TagNode color={COLOR_NAME.ORANGE} boldHash />
            Mobile
          </div>
        </div>
      </div>
      <div className={s.cover}>
        <CoverPreview />
      </div>
      <div className={s.content}>
        <div className={s.bar} />
        <div className={cn(s.bar, 'w-28 opacity-20')} />
      </div>
      <Footer upvotesCount={24} date="2013-12-01" />
      <div className={s.divider} />
      <div className="opacity-75">
        <div className={s.header}>
          <div className={s.title}>
            AI 加持的文章搜索 <div className={s.version}>v1.9</div>
          </div>

          <div className={s.tags}>
            <div className={s.tagItem}>
              <TagNode color={COLOR_NAME.GREEN} boldHash />
              Web
            </div>

            <div className={s.tagItem}>
              <TagNode color={COLOR_NAME.PINK} boldHash />
              编辑器
            </div>
          </div>
        </div>
        <div className={s.content}>
          <div className={cn(s.bar, 'w-32 opacity-25')} />
          <div className={cn(s.bar, 'w-28 opacity-20')} />
        </div>
        <Footer upvotesCount={98} date="2013-11-26" />
      </div>
    </div>
  )
}
