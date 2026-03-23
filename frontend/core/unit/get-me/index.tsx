/* eslint-disable jsx-a11y/accessible-emoji */
/* eslint-disable react/jsx-no-comment-textnodes */
/*
 */

import type { FC } from 'react'

import DownloadSVG from '~/icons/DownloadCircle'
import Tooltip from '~/widgets/Tooltip'

import Panel from './Panel'
import useSalon from './salon'

const GetMe: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Tooltip content={<Panel />} placement='bottom-end' noPadding>
        <DownloadSVG className={s.downloadIcon} />
      </Tooltip>
    </div>
  )
}

export default GetMe
