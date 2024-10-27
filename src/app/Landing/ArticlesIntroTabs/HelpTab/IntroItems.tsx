import type { FC } from 'react'

import { COLOR_NAME } from '~/const/colors'

import Button from '~/widgets/Buttons/Button'

import FeatItem from '../FeatItem'

import useSalon from '../../salon/articles_intro_tabs'

const color = COLOR_NAME.CYAN
const Contents = () => {
  return (
    <>
      <FeatItem text="保存即发布，No bullshit" color={color} />
      <FeatItem text="自定义 FAQ" color={color} />
      <FeatItem text="支持 MD 格式导入" color={color} />
      <FeatItem text="富文本内容" color={color} />
      <FeatItem text="自定义目录封面" color={color} />
      <FeatItem text="表情反馈" color={color} />
      <FeatItem text="高度自定义" color={color} />
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
