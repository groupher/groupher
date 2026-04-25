import type { FC } from 'react'
import type { TTag } from '~/spec'

import useSalon, { cn } from './salon/file_item'

type TProps = {
  tag: TTag
  active: boolean
  onSelect?: (tag?: TTag) => void
}

const FileItem: FC<TProps> = ({ tag, active, onSelect }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper)}>
      <button
        type='button'
        className={cn(s.file, active && 'py-0.5')}
        onClick={() => onSelect(tag)}
      >
        <div className={cn(s.title, active && s.primary)}>{tag.title}</div>
      </button>
      {/* {active && <Outline />} */}
      {active && <div className={s.indexDot} />}
    </div>
  )
}

export default FileItem
