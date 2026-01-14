import { COLOR_NAME } from '~/const/colors'
import useSalon from '../../salon/articles_intro_tabs/kanban_tab/intro_digest'
import FeatItem from '../FeatItem'

const color = COLOR_NAME.BLUE

export default function IntroDigest() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.digest}>
        通过经典的看板视图，让<span className={s.highlight}>用户</span>直观的了解团队相关工作的
        <span className={s.highlight}>进度</span>以及长短期<span className={s.highlight}>规划</span>
        。
      </div>

      <div className={s.features}>
        <div className={s.featItem}>
          <FeatItem text='经典简洁的 UI' color={color} />
        </div>
        <div className={s.featItem}>
          <FeatItem text='富文本内容' color={color} />
        </div>

        <div className={s.featItem}>
          <FeatItem text='状态自然同步' color={color} />
        </div>

        <div className={s.featItem}>
          <FeatItem text='评论，表情反馈' color={color} />
        </div>

        <div className={s.featItem}>
          <FeatItem text='一键切换状态' color={color} />
        </div>

        <div className={s.featItem}>
          <FeatItem text='高度自定义' color={color} />
        </div>
      </div>
    </div>
  )
}
