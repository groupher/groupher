/* *
 * ChangelogThread
 *
 */

import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import ChangelogItem from '../ChangelogItem'

import Sidebar from './Sidebar'

import useSalon from '../salon/classic_layout'

export default function ClassicLayout() {
  const s = useSalon()
  const { pagedChangelogs } = usePagedChangelogs()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        {pagedChangelogs.entries.map((item) => (
          <ChangelogItem key={item.innerId} article={item} />
        ))}
      </div>
      <Sidebar tagsMode="all" />
    </div>
  )
}
