/**
 * this selector is only used for normal user edtior
 */

import { type FC, useState, Fragment } from 'react'

import type { TTag, TGroupedTags } from '~/spec'

import Tooltip from '~/widgets/Tooltip'
import DropdownButton from '~/widgets/Buttons/DropdownButton'

import ActiveTag from './ActiveTag'
import FilterPanel from './FilterPanel'

import useSalon from './salon'

type TProps = {
  groupedTags: TGroupedTags
  activeTag: TTag | null
  onSelect?: (tag: TTag) => void
  mode?: 'mobile' | 'modeline' | 'default'
}

const TagSelector: FC<TProps> = ({ mode = 'default', groupedTags, activeTag, onSelect }) => {
  const s = useSalon()

  const [show, setShow] = useState(false)
  // @ts-ignore
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSelect = (tag: TTag) => {
    onSelect(tag)
  }

  return (
    <div className={s.wrapper}>
      <div className={s.label}>标签</div>
      <Tooltip
        placement="bottom-start"
        trigger="click"
        onShow={() => {
          setShow(true)
          setMenuOpen(true)
        }}
        onHide={() => setMenuOpen(false)}
        offset={[-35, 8]}
        content={
          <Fragment>
            {show && (
              <FilterPanel
                activeTag={activeTag}
                groupedTags={groupedTags}
                onSelect={handleSelect}
              />
            )}
          </Fragment>
        }
      >
        <DropdownButton noArrow={mode === 'modeline'}>
          <ActiveTag activeTag={activeTag} mode={mode} />
        </DropdownButton>
      </Tooltip>
    </div>
  )
}

export default TagSelector
