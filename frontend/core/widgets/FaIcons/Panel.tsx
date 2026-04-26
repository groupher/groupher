import { filter, includes, keys } from 'ramda'
import { type FC, useEffect, useState } from 'react'

import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'
import CustomScroller from '~/widgets/CustomScroller'
import Input from '~/widgets/Input'

import FaIcon from '.'
import ICONS from './icons'
import useSalon, { cn } from './salon/panel'
import type { TIcon } from './spec'

type TProps = {
  selectColor: TColorName
  selectIcon: TIcon
  onColorSelect: (color: TColorName) => void
  onIconSelect: (icon: TIcon) => void
  panelOpen: boolean
}

const Panel: FC<TProps> = ({ selectColor, selectIcon, onColorSelect, onIconSelect, panelOpen }) => {
  const s = useSalon()
  const iconKeys = keys(ICONS)
  const colorNames = keys(COLOR)

  const [searchKey, setSearchKey] = useState('')
  const filteredIconKeys = filter((k) => includes(searchKey, k), iconKeys)

  useEffect(() => {
    if (!panelOpen) {
      setSearchKey('')
    }
  }, [panelOpen])

  return (
    <div className={s.wrapper}>
      <div className={s.colorWrapper}>
        {colorNames.map((color) => (
          <div
            key={color}
            className={cn(
              s.colorBlock,
              s.rainbow(color, 'bgSoft'),
              selectColor === color && s.rainbow(color, 'border'),
            )}
            onClick={() => onColorSelect(color)}
          >
            <div className={cn(s.colorCenter, s.rainbow(color, 'bg'))} />
          </div>
        ))}
      </div>

      <Input
        className={s.input}
        value={searchKey}
        placeholder='// 搜索图标（英文）'
        onChange={(e) => setSearchKey(e.target.value)}
      />

      <CustomScroller
        direction='vertical'
        height='150px'
        barSize='small'
        showShadow={false}
        autoHide
      >
        {filteredIconKeys.map((name) => (
          <div
            className={cn(s.item, selectIcon === name && s.itemActive)}
            key={name}
            onClick={() => onIconSelect(name)}
          >
            <div className={s.iconBox}>
              <FaIcon icon={name} size={13} color={COLOR.BLACK} />
            </div>
            <div className={s.title}>{name}</div>
          </div>
        ))}
      </CustomScroller>
    </div>
  )
}

export default Panel
