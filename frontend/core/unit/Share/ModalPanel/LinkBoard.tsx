import { type FC, memo, useState } from 'react'

import CopyButton from '~/widgets/Buttons/CopyButton'
import Input from '~/widgets/Input'

import useSalon, { cn } from './salon/link_board'
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
          <button
            type='button'
            className={cn(s.tabName, activeTab === 'link' && s.tabNameActive)}
            onClick={() => setActiveTab('link')}
          >
            URL
          </button>
          <button
            type='button'
            className={cn(s.tabName, activeTab === 'html' && s.tabNameActive)}
            onClick={() => setActiveTab('html')}
          >
            HTML
          </button>

          <button
            type='button'
            className={cn(s.tabName, activeTab === 'md' && s.tabNameActive)}
            onClick={() => setActiveTab('md')}
          >
            MD
          </button>
          <button
            type='button'
            className={cn(s.tabName, activeTab === 'orgMode' && s.tabNameActive)}
            onClick={() => setActiveTab('orgMode')}
          >
            OrgMode
          </button>
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
