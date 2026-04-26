import BookSVG from '~/icons/Book'
import QuestionSVG from '~/icons/Question'
import GithubSVG from '~/icons/social/Github'

import useSalon, { cn } from '../salon/article_layout/pined_tree'
import useLogic from '../useLogic'

export default function PinedTree() {
  const s = useSalon()
  const { back2Layout, gotoFAQDetailLayout } = useLogic()

  return (
    <div className={s.wrapper}>
      <div className={s.item} onClick={() => back2Layout()}>
        <div className={s.iconBox}>
          <div className={cn(s.cover, s.grayBg)} />
          <BookSVG className={s.bookIcon} />
        </div>
        <h3 className={s.title}>全部文档</h3>
      </div>
      <div className={s.item} onClick={() => gotoFAQDetailLayout()}>
        <div className={s.iconBox}>
          <div className={cn(s.cover, s.purpleBg)} />
          <QuestionSVG className={s.normalIcon} />
        </div>
        <h3 className={s.title}>常见问题</h3>
      </div>
      <div className={s.item} onClick={() => gotoFAQDetailLayout()}>
        <div className={s.iconBox}>
          <div className={cn(s.cover, s.blackBg)} />
          <GithubSVG className={s.normalIcon} />
        </div>
        <h3 className={s.title}>Github</h3>
      </div>
    </div>
  )
}
