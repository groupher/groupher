import type { FC } from 'react'

import Img from '~/widgets/Img'
import ImgFallback from '~/widgets/ImgFallback'

import type { TDocDraftAuthor } from '../../Editor/store/spec'
import useSalon from '../salon/doc_info/author'

type TProps = {
  author: TDocDraftAuthor | null
  name: string
}

const DocInfoAuthor: FC<TProps> = ({ author, name }) => {
  const s = useSalon()

  return (
    <span className={s.author}>
      {author?.avatar ? (
        <Img
          src={author.avatar}
          className={s.authorAvatar}
          noLazy
          fallback={<ImgFallback title={name} className={s.authorAvatar} />}
        />
      ) : (
        <ImgFallback title={name} className={s.authorAvatar} />
      )}
      {name}
    </span>
  )
}

export default DocInfoAuthor
