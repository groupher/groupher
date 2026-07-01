import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import InfoSVG from '~/icons/Info'

import { DOC_ACTION_LABEL_KEY } from '../constant'
import DocInfoDrawer from '../DocInfoDrawer'
import useSalon, { cn } from '../salon/doc_info'

const DocInfo: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const [visible, setVisible] = useState(false)
  const label = t(DOC_ACTION_LABEL_KEY.INFO)

  return (
    <>
      <button
        type='button'
        className={cn(s.button, visible && s.buttonActive)}
        aria-label={label}
        title={label}
        onClick={() => setVisible(true)}
      >
        <InfoSVG className={cn(s.icon, visible && s.iconActive)} />
      </button>

      <DocInfoDrawer show={visible} onClose={() => setVisible(false)} />
    </>
  )
}

export default DocInfo
