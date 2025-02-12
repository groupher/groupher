import { callTagCreateEditor } from '~/signal'

import Button from '~/widgets/Buttons/Button'
import AddSVG from '~/icons/Plus'

import Portal from '../Portal'

import ThreadSelector from './ThreadSelector'
import GroupSelector from './GroupSelector'

import TagList from './TagList'
import Footer from './Footer'

import useSalon from '../salon/tags'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Portal title="标签设置" desc="编辑各板块标签，标签分组，颜色名称等均可编辑。" />
      <ThreadSelector />
      <GroupSelector />
      <TagList />

      <Button ghost top={10} className="w-28" size="small" onClick={() => callTagCreateEditor()}>
        <AddSVG className={s.icon} />
        新增标签
      </Button>

      <Footer />
    </div>
  )
}
