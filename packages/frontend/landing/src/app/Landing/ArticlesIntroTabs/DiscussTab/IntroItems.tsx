import ArrowLinker from '~/widgets/ArrowLinker'
import { COLOR_NAME } from '~/const/colors'

import Button from '~/widgets/Buttons/Button'

import FeatItem from '../FeatItem'
import useSalon from '../../salon/articles_intro_tabs'

const color = COLOR_NAME.PURPLE

const Contents = () => {
  return (
    <>
      <FeatItem text="投票，发帖，评论" color={color} />
      <FeatItem text="标签，状态分类" color={color} />
      <FeatItem text="富文本编辑器" color={color} />
      <FeatItem text="强大的后台管理" color={color} />
      <FeatItem text="内置搜索，SEO 优化" color={color} />
      <FeatItem text="高度自定义" color={color} />
    </>
  )
}

export default () => {
  const s = useSalon()

  return (
    <>
      <div className={s.featList}>
        <Contents />
      </div>

      <div className="grow" />
      <div className={s.footer}>
        <Button color={color}>查看示例</Button>

        <ArrowLinker href="/" color={color} className="py-2">
          了解更多
        </ArrowLinker>
      </div>
    </>
  )
}
