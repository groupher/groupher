import type { FC } from 'react'

import type { TColorName, TTag } from '~/spec'
import TagNode from '~/widgets/TagNode'

import useSalon from './salon/active_tag'

type TProps = {
  activeTag: TTag
  mode: 'mobile' | 'modeline' | 'default'
}

const ActiveTag: FC<TProps> = ({ activeTag, mode }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {activeTag?.id ? (
        <div className={s.tagItem}>
          <TagNode color={activeTag.color as TColorName} boldHash />
          <div className={s.tagTitle}>{activeTag.title}</div>
        </div>
      ) : (
        <>{mode === 'default' ? '未设置' : '标签'}</>
      )}
    </div>
  )
}

export default ActiveTag
