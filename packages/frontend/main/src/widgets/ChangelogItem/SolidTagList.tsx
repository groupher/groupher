import type { FC } from 'react'

import type { TColorName, TTag } from '~/spec'

import useSalon from './salon/solid_tag_list'

type TProps = {
  tags: TTag[]
}

const Tag: FC<{ info: TTag }> = ({ info }) => {
  const s = useSalon({ color: info.color as TColorName })

  return (
    <div className={s.tag}>
      <div className={s.name}>{info.title}</div>
    </div>
  )
}

const SolidTagList: FC<TProps> = ({ tags }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {tags.map((tag) => (
        <Tag key={tag.slug} info={tag} />
      ))}
    </div>
  )
}

export default SolidTagList
