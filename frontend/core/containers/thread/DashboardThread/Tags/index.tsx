import AddSVG from '~/icons/Plus'
import { callTagCreateEditor } from '~/signal'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../salon/tags'
import Footer from './Footer'
import GroupSelector from './GroupSelector'
import TagList from './TagList'
import ThreadSelector from './ThreadSelector'

export default () => {
  const s = useSalon()

  return (
    <>
      <ThreadSelector />
      <GroupSelector />
      <TagList />

      <Button ghost top={10} className='w-28' size='small' onClick={() => callTagCreateEditor()}>
        <AddSVG className={s.icon} />
        新增标签
      </Button>

      <Footer />
    </>
  )
}
