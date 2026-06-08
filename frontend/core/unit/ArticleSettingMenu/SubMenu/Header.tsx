import type { FC } from 'react'

import CategorySVG from '~/icons/Category'
import EditSVG from '~/icons/EditPen'
import WipSVG from '~/icons/GtdWip'
import InfoSVG from '~/icons/Info'
import SlugSVG from '~/icons/Slug'
import TagNode from '~/widgets/TagNode'

import { SUB_MENU } from '../constant'
import type { TSubMenu } from '../spec'
import useSalon from './salon/header'

type TProps = {
  type: TSubMenu
}

const Header: FC<TProps> = ({ type }) => {
  const s = useSalon()

  let Content = null
  let showDivider = true

  switch (type) {
    case SUB_MENU.EDIT: {
      Content = (
        <>
          <EditSVG className={s.icon} />
          修改标题
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )
      showDivider = false

      break
    }

    case SUB_MENU.CATEGORY: {
      Content = (
        <>
          <CategorySVG className={s.icon} />
          设置分类
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )

      break
    }

    case SUB_MENU.STATUS: {
      Content = (
        <>
          <WipSVG className={s.icon} />
          设置状态
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )

      break
    }

    case SUB_MENU.SLUG: {
      Content = (
        <>
          <SlugSVG className={s.icon} />
          设置路径 (Slug)
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )
      showDivider = false

      break
    }

    case SUB_MENU.MIRROR: {
      Content = (
        <>
          <SlugSVG className={s.icon} />
          镜像到 Groupher
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )

      break
    }

    case SUB_MENU.TAGS: {
      Content = (
        <>
          <TagNode hashSize={3.5} hashRight={0.5} />
          设置标签
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )
      break
    }

    default: {
      Content = (
        <>
          <div>??</div>
          <div className='grow' />
          <InfoSVG className={s.questionIcon} />
        </>
      )
    }
  }

  return (
    <>
      <div className={s.inner}>{Content}</div>
      {showDivider && <div className={s.divider} />}
    </>
  )
}

export default Header
