import type { FC } from 'react'
import { mockImage, mockUsers } from '~/mock'
import type { TArticle } from '~/spec'
import Facepile from '~/widgets/Facepile'
import useSalon from '../salon/cover_cards_layout/category'
import useLogic from '../useLogic'

type TProps = {
  index: number
  title: string
  desc: string
  articles: TArticle[]
}

const Category: FC<TProps> = ({ index, title, desc, articles }) => {
  const s = useSalon()
  const { gotoDetailLayout } = useLogic()

  return (
    <button type='button' className={s.wrapper} onClick={() => gotoDetailLayout()}>
      <div
        className={s.cover}
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(16,16,16,0.05), rgba(16,16,16,0.55)), url(${mockImage()})`,
        }}
      >
        <div className={s.coverInner}>
          <div className={s.coverMeta}>Featured {index + 1}</div>
          <div className={s.coverTitle}>{title}</div>
        </div>
      </div>

      <div className={s.content}>
        <div className={s.desc}>{desc}</div>
        <div className={s.footer}>
          <Facepile users={mockUsers(2)} total={3} />
          <div className={s.count}>{articles.length} 篇文档</div>
        </div>
      </div>
    </button>
  )
}

export default Category
