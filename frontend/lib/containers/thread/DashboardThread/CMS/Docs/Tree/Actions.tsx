/* eslint-disable react/no-unescaped-entities */
import type { FC } from 'react'

import AdderSVG from '~/icons/Plus'
import EditSVG from '~/icons/EditPen'

import Button from '~/widgets/Buttons/Button'

import useSalon from '../../../salon/cms/docs/tree/actions'

const Actions: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.preview}>
        <div className={s.head}>
          <div className={s.title}>Mac 下怎样安全使用。</div>
          <div className={s.updateHint}>1 天前更新</div>
        </div>
        <div className={s.previewButtons}>
          <Button size="small" ghost noBorder left={-2.5}>
            <EditSVG className={s.editIcon} />
            编辑文档
          </Button>

          <Button size="small" ghost noBorder>
            <EditSVG className={s.editIcon} />
            添加 Slug
          </Button>
        </div>
      </div>
      <div className={s.previewButtons}>
        <Button size="small" ghost>
          <AdderSVG className={s.addIcon} />
          置顶链接&nbsp;
        </Button>
        <Button size="small" ghost>
          <AdderSVG className={s.addIcon} />
          节点&nbsp;
        </Button>
        <Button size="small" ghost>
          <AdderSVG className={s.addIcon} />
          目录&nbsp;
        </Button>
      </div>
    </div>
  )
}

export default Actions
