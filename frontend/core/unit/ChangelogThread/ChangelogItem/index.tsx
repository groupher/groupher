import type { FC } from 'react'

import { CHANGELOG_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import type { TArticleState, TChangelog } from '~/spec'

import ClassicLayout from './ClassicLayout'
import SimpleLayout from './SimpleLayout'

type TProps = {
  viewModel: TArticleState<TChangelog>
}

const ChangelogItem: FC<TProps> = ({ viewModel }) => {
  const { changelogLayout } = useLayout()

  return (
    <div>
      {changelogLayout === CHANGELOG_LAYOUT.CLASSIC && <ClassicLayout viewModel={viewModel} />}
      {changelogLayout === CHANGELOG_LAYOUT.SIMPLE && <SimpleLayout viewModel={viewModel} />}
    </div>
  )
}

export default ChangelogItem
