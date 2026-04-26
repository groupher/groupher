import type { FC } from 'react'

import CheckSVG from '~/icons/Check'
import Markdown from '~/widgets/Markdown'

import type { TProps as TIndex } from '.'
import useSalon from './salon/flat'

type TProps = Pick<TIndex, 'sections' | 'large'>

const Flat: FC<TProps> = ({ sections, large }) => {
  const s = useSalon({ large })

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.brandText}>常见问题</div>
      </div>
      <div className={s.content}>
        {sections.map((item) => (
          <div className={s.section} key={item.title}>
            <div className='row-center'>
              <div className={s.checkBox}>
                <CheckSVG className={s.checkIcon} />
              </div>
              <div className={s.title}>{item.title}</div>
            </div>
            <div className={s.body}>
              <Markdown>{item.body}</Markdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Flat
