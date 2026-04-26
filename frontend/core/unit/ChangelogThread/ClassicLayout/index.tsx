/* *
 * ChangelogThread
 *
 */

import usePagedChangelogs from '~/hooks/usePagedChangelogs'

import ChangelogItem from '../ChangelogItem'
import useSalon from '../salon/classic_layout'
import Sidebar from './Sidebar'

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
      <Sidebar tagsMode='all' />
    </div>
  )
}
