import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TColor } from '~/spec'
import ArrowLinker from '~/widgets/ArrowLinker'

type TProps = {
  title?: string
  href?: string
} & TColor

const MoreLink: FC<TProps> = ({ title = '了解更多', href = '/', color }) => {
  const { t } = useTrans()

  return (
    <ArrowLinker href={href} color={color} top={10}>
      {title === '了解更多' ? t('landing.articles.common.more') : title}
    </ArrowLinker>
  )
}

export default MoreLink
