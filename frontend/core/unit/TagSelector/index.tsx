/**
 * this selector is only used for normal user edtior
 */

import { type FC, useState } from 'react'

import type { TGroupedTags, TTag } from '~/spec'
import DropdownButton from '~/widgets/Buttons/DropdownButton'
import Tooltip from '~/widgets/Tooltip'

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
  const handleSelect = (tag: TTag) => {
    onSelect?.(tag)
  }

  return (
    <div className={s.wrapper}>
      <div className={s.label}>标签</div>
      <Tooltip
        placement='bottom-start'
        trigger='click'
        onShow={() => {
          setShow(true)
        }}
        offset={[-35, 8]}
        content={
          show ? (
            <FilterPanel activeTag={activeTag} groupedTags={groupedTags} onSelect={handleSelect} />
          ) : null
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
