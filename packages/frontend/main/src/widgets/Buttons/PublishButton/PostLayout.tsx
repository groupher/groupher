/*
 *
 * PublishButton
 *
 */

import { memo, type FC } from 'react'
import EditPenSVG from '~/icons/EditPen'

import useSalon from '../salon/publish_button/post_layout'

type TProps = {
  text: string
}

const PostLayout: FC<TProps> = ({ text }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <EditPenSVG className={s.editIcon} />
      <div className={s.title}>{text}</div>
      <div className="grow" />
    </div>
  )
}

export default memo(PostLayout)
