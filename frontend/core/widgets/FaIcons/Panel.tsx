import { filter, includes, keys } from 'ramda'
import { type FC, useState } from 'react'
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
  const effectiveSearchKey = panelOpen ? searchKey : ''
  const filteredIconKeys = filter((k) => includes(effectiveSearchKey, k), iconKeys)

  return (
    <div className={s.wrapper}>
      <div className={s.colorWrapper}>
        {colorNames.map((color) => (
          <button
            type='button'
            key={color}
            className={cn(
              s.colorBlock,
              s.rainbow(color, 'bgSoft'),
              selectColor === color && s.rainbow(color, 'border'),
            )}
            onClick={() => onColorSelect(color)}
          >
            <div className={cn(s.colorCenter, s.rainbow(color, 'bg'))} />
          </button>
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
          <button
            type='button'
            className={cn(s.item, selectIcon === name && s.itemActive)}
            key={name}
            onClick={() => onIconSelect(name)}
          >
            <div className={s.iconBox}>
              <FaIcon icon={name} size={13} color={COLOR.BLACK} />
            </div>
            <div className={s.title}>{name}</div>
          </button>
        ))}
      </CustomScroller>
    </div>
  )
}

export default Panel
