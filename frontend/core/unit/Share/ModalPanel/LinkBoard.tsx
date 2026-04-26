import { type FC, memo, useState } from 'react'

import CopyButton from '~/widgets/Buttons/CopyButton'
import Input from '~/widgets/Input'

import useSalon, { cn } from '../salon/modal_panel/link_board'
import type { TLinksData } from '../spec'

type TProps = {
  linksData: TLinksData
}

const LinkBoard: FC<TProps> = ({ linksData }) => {
  const s = useSalon()
  const [activeTab, setActiveTab] = useState('link')

  return (
    <>
      <div className={s.header}>
        <div className={s.tabs}>
          <div
            className={cn(s.tabName, activeTab === 'link' && s.tabNameActive)}
            onClick={() => setActiveTab('link')}
          >
            URL
          </div>
          <div
            className={cn(s.tabName, activeTab === 'html' && s.tabNameActive)}
            onClick={() => setActiveTab('html')}
          >
            HTML
          </div>

          <div
            className={cn(s.tabName, activeTab === 'md' && s.tabNameActive)}
            onClick={() => setActiveTab('md')}
          >
            MD
          </div>
          <div
            className={cn(s.tabName, activeTab === 'orgMode' && s.tabNameActive)}
            onClick={() => setActiveTab('orgMode')}
          >
            OrgMode
          </div>
        </div>
        <CopyButton value={linksData[activeTab]} />
      </div>
      <div className={s.box}>
        <Input value={linksData[activeTab]} className={s.input} />
      </div>
    </>
  )
}

export default memo(LinkBoard)
