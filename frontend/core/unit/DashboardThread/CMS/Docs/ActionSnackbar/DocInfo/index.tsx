import { type FC, useState } from 'react'

import InfoSVG from '~/icons/Info'
import Tooltip from '~/widgets/Tooltip'

import { DOC_ACTION } from '../constant'
import useSalon, { cn } from '../salon/doc_info'
import DocInfoPanel from './Panel'

const DocInfo: FC = () => {
  const s = useSalon()
  const [visible, setVisible] = useState(false)

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
        aria-label={DOC_ACTION.INFO}
        title={DOC_ACTION.INFO}
        onClick={() => setVisible((prev) => !prev)}
      >
        <InfoSVG className={cn(s.icon, visible && s.iconActive)} />
      </button>
    </Tooltip>
  )
}

export default DocInfo
