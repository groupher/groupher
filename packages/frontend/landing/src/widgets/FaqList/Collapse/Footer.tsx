import { type FC, memo } from 'react'

import BookSVG from '~/icons/Book'
import PeopleSVG from '~/icons/People'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../salon/collapse/footer'

const Footer: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.note}>没能解决你的问题？</div>
      <div className={s.bottom}>
        <Button space={5}>
          <BookSVG className={s.bookIcon} />
          更多文档
        </Button>
        <Button ghost space={5}>
          <PeopleSVG className={s.peopleIcon} />
          社区求助
        </Button>
      </div>
    </div>
  )
}

export default memo(Footer)
