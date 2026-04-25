import type { FC } from 'react'
import { THREAD_PATH } from '~/const/thread'
import { mockHelpCats } from '~/mock'
import useCommunity from '~/stores/community/hooks'

import ArrowLinker from '~/widgets/ArrowLinker'
import type { TProps as TIndex } from '..'
import useSalon from '../salon/search_hint'
import CatSection from './CatSection'

type TProps = Pick<TIndex, 'sections'>

const SearchHint: FC<TProps> = ({ sections: _sections }) => {
  const s = useSalon()

  const { slug: community } = useCommunity()
  const cats = mockHelpCats()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.title}>常见问题</div>
      </div>
      <div className={s.body}>
        {cats.map((item) => (
          <CatSection key={item.title} item={item} />
        ))}
      </div>

      <div className={s.footer}>
        更多类似问题，请移步
        <ArrowLinker href={`/${community}/${THREAD_PATH.DOC}`} left={1}>
          文档
        </ArrowLinker>
      </div>
    </div>
  )
}

export default SearchHint
