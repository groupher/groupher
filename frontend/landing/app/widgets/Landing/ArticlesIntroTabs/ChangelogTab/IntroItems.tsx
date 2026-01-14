import { COLOR_NAME } from '~/const/colors'

import ArrowLinker from '~/widgets/ArrowLinker'
import Button from '~/widgets/Buttons/Button'
import useSalon, { cn } from '../../salon/articles_intro_tabs'
import FeatItem from '../FeatItem'

const color = COLOR_NAME.RED

const Contents = () => {
  return (
    <>
      <FeatItem text='封面图片编辑' color={color} />
      <FeatItem text='强大的富文本内容' color={color} />
      <FeatItem text='标签，版本，时间归档' color={color} />
      <FeatItem text='评论，表情反馈' color={color} />
      <FeatItem text='一键多渠道分享' color={color} />
      <FeatItem text='自定义模板' color={color} />
    </>
  )
}

export default function IntroItems() {
  const s = useSalon()

  return (
    <>
      <div className={s.featList}>
        <Contents />
      </div>

      <div className='grow' />
      <div className={cn(s.footer, 'mt-16')}>
        <Button color={color} ghost>
          查看示例
        </Button>
        <ArrowLinker href='/' color={color} className='py-2'>
          了解更多
        </ArrowLinker>
      </div>
    </>
  )
}
