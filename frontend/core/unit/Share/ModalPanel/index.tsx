/*
 * Share
 */

import useMobileDetect from '@groupher/use-mobile-detect-hook'
import type { FC } from 'react'

import type { TArticle } from '~/spec'
import Modal from '~/widgets/Modal'

import useSalon, { cn } from '../salon/modal_panel'
import type { TLinksData } from '../spec'
import InfoPanel from './InfoPanel'
import Platforms from './Platforms'

type TProps = {
  show: boolean
  offsetLeft: string
  siteShareType: string
  linksData: TLinksData
  article: TArticle
  testid?: string
  onClose: () => void
  changeType: (type: string) => void
}

const SharePanel: FC<TProps> = ({
  show,
  offsetLeft,
  siteShareType,
  linksData,
  article,
  onClose,
  changeType,
}) => {
  const s = useSalon()
  const { isMobile } = useMobileDetect()

  if (isMobile) {
    return (
      <div className={cn(s.wrapper, 'w-full')}>
        <Platforms article={article} changeType={changeType} />
        <InfoPanel type={siteShareType} linksData={linksData} />
      </div>
    )
  }

  return (
    <Modal width='450px' show={show} offsetLeft={offsetLeft} onClose={onClose} showCloseBtn>
      <div className={s.wrapper}>
        <Platforms article={article} changeType={changeType} />
        <InfoPanel type={siteShareType} linksData={linksData} />
      </div>
    </Modal>
  )
}

export default SharePanel
