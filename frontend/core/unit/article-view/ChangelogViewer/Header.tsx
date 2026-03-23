import { type FC, Fragment } from 'react'

import type { TChangelog } from '~/spec'
import ArticleCatState from '~/unit/article-cat-state'
import DotDivider from '~/widgets/DotDivider'
import TagsList from '~/unit/tags-list'

import useSalon from '../salon/changelog_viewer/header'

type TProps = {
  article: TChangelog
}

const Header: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { meta, cat, state, communityTags } = article

  return (
    <div className={s.wrapper}>
      <ArticleCatState cat={cat} state={state} smaller={false} right={4} />
      <TagsList items={communityTags} size='medium' />
      <div className={s.publishWrapper}>
        {meta.isEdited && (
          <Fragment>
            <DotDivider className='mx-2' />
            <div className={s.editedHint}>修改过</div>
          </Fragment>
        )}
      </div>
    </div>
  )
}

export default Header
