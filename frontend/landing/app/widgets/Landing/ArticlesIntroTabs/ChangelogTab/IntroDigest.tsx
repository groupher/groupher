import useSalon from '../../salon/articles_intro_tabs/changelog_tab/intro_digest'
import IntroItems from './IntroItems'

export default function IntroDigest() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>版本日志 / 新功能 / 错误修复</div>
      <div className={s.digest}>
        官方团队发布，方便用户快速获取产品
        <span className={s.highlight}>新功能</span>, <span className={s.highlight}>Bug 修复</span>
        等动态。
      </div>

      <IntroItems />
    </div>
  )
}
