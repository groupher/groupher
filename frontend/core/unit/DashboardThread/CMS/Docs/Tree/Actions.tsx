import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import EditSVG from '~/icons/EditPen'
import AdderSVG from '~/icons/Plus'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../../salon/docs/tree/actions'

const Actions: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.preview}>
        <div className={s.head}>
          <div className={s.title}>{t('dsb.cms.docs.tree.actions.sample_title')}</div>
          <div className={s.updateHint}>{t('dsb.cms.docs.tree.actions.sample_update')}</div>
        </div>
        <div className={s.previewButtons}>
          <Button size='small' ghost noBorder left={-2.5}>
            <EditSVG className={s.editIcon} />
            {t('dsb.cms.docs.tree.actions.edit')}
          </Button>

          <Button size='small' ghost noBorder>
            <EditSVG className={s.editIcon} />
            {t('dsb.cms.docs.tree.actions.add_slug')}
          </Button>
        </div>
      </div>
      <div className={s.previewButtons}>
        <Button size='small' ghost>
          <AdderSVG className={s.addIcon} />
          {t('dsb.cms.docs.tree.actions.pin_link')}&nbsp;
        </Button>
        <Button size='small' ghost>
          <AdderSVG className={s.addIcon} />
          {t('dsb.cms.docs.tree.actions.node')}&nbsp;
        </Button>
        <Button size='small' ghost>
          <AdderSVG className={s.addIcon} />
          {t('dsb.cms.docs.tree.actions.folder')}&nbsp;
        </Button>
      </div>
    </div>
  )
}

export default Actions
