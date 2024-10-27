import IntroItems from './IntroItems'

import useSalon from '../../salon/articles_intro_tabs/discuss_tab/intro_digest'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>功能请求 / Bug / 技术支持</div>
      <div className={s.digest}>
        完善易用的论坛功能，满足<span className={s.highlight}>用户与团队</span>，
        <span className={s.highlight}>用户与用户</span>
        间的互动交流。
      </div>

      <IntroItems />
    </div>
  )
}
