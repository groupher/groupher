import type { FC } from 'react'

import { COLOR_NAME } from '~/const/colors'

import Button from '~/widgets/Buttons/Button'
import FeatItem from '../FeatItem'

import useSalon from '../../salon/articles_intro_tabs'

const color = COLOR_NAME.RED

const Contents = () => {
  return (
    <>
      <FeatItem text="封面图片编辑" color={color} />
      <FeatItem text="强大的富文本内容" color={color} />
      <FeatItem text="标签，版本，时间归档" color={color} />
      <FeatItem text="评论，表情反馈" color={color} />
      <FeatItem text="一键多渠道分享" color={color} />
      <FeatItem text="自定义模板" color={color} />
    </>
  )
}

const IntroItems: FC = () => {
  const s = useSalon()

  return (
    <>
      <div className={s.featList}>
        <Contents />
      </div>

      <div className="grow" />
      <div className="w-32 mt-14 row gap-x-2">
        <Button color={color}>查看示例</Button>
        <Button color={color} ghost>
          了解更多
        </Button>
      </div>
    </>
  )
}

export default IntroItems
