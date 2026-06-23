import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import InfoSVG from '~/icons/Info'
import Tooltip from '~/widgets/Tooltip'

import { DOC_ACTION_LABEL_KEY } from '../constant'
import useSalon, { cn } from '../salon/doc_info'
import DocInfoPanel from './Panel'

const DocInfo: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const [visible, setVisible] = useState(false)
  const label = t(DOC_ACTION_LABEL_KEY.INFO)

  return (
    <Tooltip
      content={<DocInfoPanel />}
      placement='top'
      offset={[55, 10]}
      maxWidth='none'
      noPadding
      hideOnClick={false}
      visible={visible}
      onShow={() => setVisible(true)}
      onHide={() => setVisible(false)}
    >
      <button
        type='button'
        className={cn(s.button, visible && s.buttonActive)}
        aria-label={label}
        title={label}
        onClick={() => setVisible((prev) => !prev)}
      >
        <InfoSVG className={cn(s.icon, visible && s.iconActive)} />
      </button>
    </Tooltip>
  )
}

export default DocInfo
