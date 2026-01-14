import IntroItems from './IntroItems'

import useSalon from '../../salon/articles_intro_tabs/help_tab/intro_digest'

export default function IntroDigest() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>知识库 / 教程 / 产品手册</div>
      <div className={s.digest}>
        沉淀<span className={s.highlight}>常见问题</span>，
        <span className={s.highlight}>公共知识库</span>等文档类内容，快速解决用户遇到的问题。
      </div>

      <IntroItems />
    </div>
  )
}
