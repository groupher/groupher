import { type FC, Fragment } from 'react'

import type { TPost } from '~/spec'

import DotDivider from '~/widgets/DotDivider'
import ArticleCatState from '~/widgets/ArticleCatState'
import TagsList from '~/widgets/TagsList'

import useSalon from '../salon/post_viewer/header'

type TProps = {
  article: TPost
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { meta, cat, state, articleTags } = article

  return (
    <div className={s.wrapper}>
      <ArticleCatState cat={cat} state={state} smaller={false} right={4} />
      <TagsList items={articleTags} size="medium" />
      <div className={s.publishWrapper}>
        {meta.isEdited && (
          <Fragment>
            <DotDivider className="mx-2" />
            <div className={s.editedHint}>修改过</div>
          </Fragment>
        )}
      </div>
    </div>
  )
}

export default Header
