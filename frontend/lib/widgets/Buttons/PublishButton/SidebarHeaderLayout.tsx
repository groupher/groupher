/*
 *
 * PublishButton
 *
 */

import { memo, type FC, Fragment } from 'react'
import EditPenSVG from '~/icons/EditPen'

import useSalon from '../salon/publish_button/sidebar_header_layout'

type TProps = {
  text: string
}

const SidebarHeaderLayout: FC<TProps> = ({ text }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Fragment>
        <EditPenSVG className={s.editIcon} />
        <div className={s.title}>{text}</div>
      </Fragment>
    </div>
  )
}

export default memo(SidebarHeaderLayout)
