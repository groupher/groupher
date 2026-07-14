import type { FC } from 'react'

import TagsList from '~/unit/TagsList'

import useSalon from './salon'
import type { TTrashedPost } from './spec'

type TProps = {
  item: TTrashedPost
}

const TitleCell: FC<TProps> = ({ item }) => {
  const s = useSalon()
  const article = item.article

  if (!article) return <div className={s.missingTitle}>{item.articleRef}</div>

  return (
    <div className={s.titleCell}>
      <div className={s.articleTitle}>
        ({article.innerId}) {article.title}
      </div>
      <TagsList items={article.communityTags ?? []} left={0} />
    </div>
  )
}

export default TitleCell
