import type { FC } from 'react'

import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import InfoSVG from '~/icons/Info'
import Drawer from '~/widgets/Drawer'

import { DOC_INFO_LABEL_KEY } from '../constant'
import DocInfoPanel from '../DocInfo/Panel'
import useSalon from '../salon/doc_info/drawer'

type TProps = {
  show: boolean
  onClose: () => void
}

const DocInfoDrawer: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <Drawer show={show} onClose={onClose} type={TYPE.DRAWER.DOC_INFO}>
      <div className={s.wrapper}>
        <div className={s.header}>
          <div className={s.titleGroup}>
            <InfoSVG className={s.titleIcon} />
            <div className={s.title}>{t(DOC_INFO_LABEL_KEY.TITLE)}</div>
          </div>
          <button
            type='button'
            className={s.closeButton}
            aria-label={t(DOC_INFO_LABEL_KEY.CLOSE)}
            onClick={onClose}
          >
            <CloseLightSVG className={s.closeIcon} />
          </button>
        </div>

        <div className={s.body}>
          <DocInfoPanel />
        </div>
      </div>
    </Drawer>
  )
}

export default DocInfoDrawer
