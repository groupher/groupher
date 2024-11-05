import { type FC, useState } from 'react'

import BrowserHead from './BrowerHead'
import Content from './Content'
import MaskPanel from './MaskPanel'

import type { TStep, TCommunityType } from '../../spec'
import useSalon from '../../salon/content/fake_browser'

type TProps = {
  step: TStep
  domain?: string
  title?: string
  desc?: string
  logo?: string | null
  communityType?: TCommunityType
}

const FakeBrowser: FC<TProps> = ({
  step,
  domain = '',
  title = '',
  desc = '',
  logo = null,
  communityType = null,
}) => {
  const s = useSalon()

  const [activePath, setActivePath] = useState('')

  return (
    <div className={s.wrapper}>
      <BrowserHead domain={domain} title={title} desc={desc} activePath={activePath} />
      <Content
        title={title}
        desc={desc}
        logo={logo}
        communityType={communityType}
        onHoverThread={setActivePath}
      />
      <MaskPanel step={step} />
    </div>
  )
}

export default FakeBrowser
