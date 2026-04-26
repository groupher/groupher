import ArrowButton from '~/widgets/Buttons/ArrowButton'

import useSalon from '../salon/article_layout/navi_head'
import useLogic from '../useLogic'
import HeadAction from './HeadAction'

export default function NaviHead() {
  const s = useSalon()
  const { back2Layout } = useLogic()

  return (
    <div className={s.wrapper}>
      <ArrowButton leftLayout onClick={() => back2Layout()} className='mt-px text-xs'>
        全部
      </ArrowButton>
      <div className={s.slash}>/</div>
      <div className={s.cur}>产品</div>
      <div className='grow' />
      <HeadAction />
    </div>
  )
}
