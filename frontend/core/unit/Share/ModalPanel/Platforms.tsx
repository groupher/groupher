import type { FC } from 'react'

import type { TArticle } from '~/spec'

import { PLATFORMS } from '../constant'
import useSalon, { Icon } from './salon/platform'

type TProps = {
  article: TArticle
  changeType: (type: string) => void
}

const Platforms: FC<TProps> = ({ article, changeType }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.hint}>分享</div>
        <div className={s.article}>{article.title}</div>
        <div className={s.hint}>到:</div>
      </div>
      <div className={s.inner}>
        {PLATFORMS.map((item) => {
          const CurIcon = Icon[item.type]

          return (
            <button
              type='button'
              className={s.media}
              key={item.title}
              onClick={() => changeType(item.type)}
            >
              <div className={s.logoBox}>
                <CurIcon className={s.icon} />
              </div>
              <div className={s.title}>{item.title}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default Platforms
