import type { FC } from 'react'

import type { TChangelog } from '~/spec'
import { CHANGELOG_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

import ClassicLayout from './ClassicLayout'
import SimpleLayout from './SimpleLayout'
// import OutlineLayout from './OutlineLayout'

type TProps = {
  article: TChangelog
}

const ChangelogItem: FC<TProps> = ({ article }) => {
  const { changelogLayout } = useLayout()

  return (
    <div>
      {changelogLayout === CHANGELOG_LAYOUT.CLASSIC && <ClassicLayout article={article} />}
      {changelogLayout === CHANGELOG_LAYOUT.SIMPLE && <SimpleLayout article={article} />}
    </div>
  )
}

export default ChangelogItem
