import { filter, includes, keys } from 'ramda'
import { type FC, useEffect, useState } from 'react'

import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import type { TColorName } from '~/spec'
import CustomScroller from '~/widgets/CustomScroller'
import Input from '~/widgets/Input'

import FaIcon from '.'
import { ICONS } from './icons'
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
  const { t } = useTrans()
  const iconKeys = ICONS.fa
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
          <button
            key={color}
            type='button'
            className={cn(
              s.colorBlock,
              s.rainbow(color, 'bgSoft'),
              selectColor === color && s.rainbow(color, 'border'),
            )}
            aria-label={`${t('icon.select_color')}: ${color}`}
            aria-pressed={selectColor === color}
            onClick={() => onColorSelect(color)}
          >
            <span className={cn(s.colorCenter, s.rainbow(color, 'bg'))} />
          </button>
        ))}
      </div>

      <Input
        className={s.input}
        value={searchKey}
        aria-label={t('icon.search')}
        placeholder={t('icon.search')}
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
            className={cn(s.item, selectIcon === name && s.itemActive)}
            key={name}
            type='button'
            aria-label={name}
            aria-pressed={selectIcon === name}
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
