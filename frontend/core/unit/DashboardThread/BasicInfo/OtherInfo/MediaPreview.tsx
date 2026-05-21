import Link from 'next/link'
import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowUpRight'
import Img from '~/Img'
import type { TMediaReport } from '~/spec'

import useSalon from '../salon/other_info/media_preview'

type TProps = {
  item: TMediaReport
}

const MediaPreview: FC<TProps> = ({ item }) => {
  const s = useSalon()
  const { url, favicon, siteName, title } = item

  return (
    <div className={s.wrapper}>
      <div className={s.brand}>
        <Img className={s.favicon} src={favicon} />
        <div className={s.siteName}>{siteName}</div>
      </div>

      <Link className={s.title} href={url} target='_blank'>
        {title}
      </Link>
      <div className={s.arrowBox}>
        <ArrowSVG className={s.arrow} />
      </div>
    </div>
  )
}

export default MediaPreview
