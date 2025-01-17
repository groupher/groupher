import type { FC } from 'react'

// import { config, library } from '@fortawesome/fontawesome-svg-core'
// config.autoAddCss = false

import type { TColorName } from '~/spec'

import Button from '~/widgets/Buttons/Button'
import PlusSVG from '~/icons/Plus'
import MoreSVG from '~/icons/menu/More'
import FaIconSelector from '~/widgets/FaIcons/Selector'
import Tooltip from '~/widgets/Tooltip'

import BlockMenu from './BlockMenu'
// import FileItem from './FileItem'

import useSalon from '../../salon/doc/block_layout/block'

type TProps = {
  color: TColorName
  title: string
}

const Block: FC<TProps> = ({ color, title }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={<BlockMenu />}
        placement="bottom-end"
        trigger="mouseenter focus"
        offset={[4, 20]}
        hideOnClick
        noPadding
      >
        <MoreSVG className={s.globalSettingIcon} />
      </Tooltip>
      <div className={s.header}>
        <FaIconSelector size={15} left={0} bottom={5} />
        <div className={s.title}>{title}</div>
      </div>

      {/* <FileItem name={desc} />
      <FileItem name={desc} /> */}

      <Button ghost size="small" className={s.adderBtn}>
        <PlusSVG className={s.plusIcon} /> 添加文章
      </Button>
    </div>
  )
}

export default Block
