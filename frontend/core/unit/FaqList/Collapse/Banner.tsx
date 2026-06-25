import { pluck } from 'ramda'
import { type FC, memo, useCallback } from 'react'

import ArrowSVG from '~/icons/ArrowSolid'
import type { TFAQSection, TMenuOption } from '~/spec'
import MenuButton from '~/widgets/Buttons/MenuButton'

import useSalon from './salon/banner'

type TProps = {
  menuOptions: TMenuOption[]
  setOpenedIds: (ids: string[]) => void
  sections: TFAQSection[]
}

const Banner: FC<TProps> = ({ menuOptions, setOpenedIds, sections }) => {
  const s = useSalon()

  const foldAll = () => setOpenedIds([])
  const unFoldAll = useCallback(() => setOpenedIds(pluck('id', sections)), [sections, setOpenedIds])

  const handleMenu = (key) => {
    switch (key) {
      case 'fold': {
        foldAll()
        return
      }
      case 'unfold': {
        unFoldAll()
        return
      }

      default: {
        console.log('## todo')
        return
      }
    }
  }

  return (
    <div className={s.wrapper}>
      <div className={s.title}>常见问题</div>
      <div className={s.menu}>
        <MenuButton placement='bottom-end' options={menuOptions} onClick={(key) => handleMenu(key)}>
          <ArrowSVG className={s.arrowIcon} />
        </MenuButton>
      </div>
    </div>
  )
}

export default memo(Banner)
