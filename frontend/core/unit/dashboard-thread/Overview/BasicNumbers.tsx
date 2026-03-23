import { prettyNum } from '~/fmt'

import NoteTip from '~/widgets/NoteTip'

import useOverview from '../logic/useOverview'
import useSalon from '../salon/overview/basic_numbers'

export default function BasicNumbers() {
  const s = useSalon()
  const { views, subscribersCount, postsCount, changelogsCount, docsCount } = useOverview()

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <section className={s.section}>
          <div className={s.hint}>社区浏览</div>
          <div className={s.num}>{prettyNum(views)}</div>
        </section>
      </div>
      <div className={s.right}>
        <section className={s.section}>
          <div className={s.hint}>
            参与互动人数
            <NoteTip left={1} placement='top'>
              参与过发帖，评论，Emoji 反馈的人数
            </NoteTip>
          </div>
          <div className={s.num}>{prettyNum(subscribersCount)}</div>
        </section>

        <section className={s.section}>
          <div className={s.hint}>帖子总数</div>
          <div className={s.num}>{prettyNum(postsCount)}</div>
        </section>

        <section className={s.section}>
          <div className={s.hint}>更新日志总数</div>
          <div className={s.num}>{prettyNum(changelogsCount)}</div>
        </section>

        <section className={s.section}>
          <div className={s.hint}>文档总数</div>
          <div className={s.num}>{prettyNum(docsCount)}</div>
        </section>
      </div>
    </div>
  )
}
