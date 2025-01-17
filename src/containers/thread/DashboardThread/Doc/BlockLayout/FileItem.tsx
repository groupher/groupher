import type { FC } from 'react'

import MoreSVG from '~/icons/menu/More'
import Tooltip from '~/widgets/Tooltip'

import FileMenu from './FileMenu'

import useSalon from '../../salon/doc/block_layout/file_item'

type TProps = {
  name: string
}

const FileItem: FC<TProps> = ({ name }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.name}>{name}</div>

      <Tooltip
        content={<FileMenu />}
        placement="bottom-end"
        trigger="mouseenter focus"
        offset={[8, 5]}
        hideOnClick
        noPadding
      >
        <MoreSVG className={s.settingIcon} />
      </Tooltip>
    </div>
  )
}

export default FileItem
