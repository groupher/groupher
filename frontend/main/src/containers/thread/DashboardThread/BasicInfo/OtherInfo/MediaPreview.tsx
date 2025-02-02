import type { FC } from 'react'
import Link from 'next/link'

import type { TMediaReport } from '~/spec'

import Img from '~/Img'
import ArrowSVG from '~/icons/ArrowUpRight'

import useSalon from '../../salon/basic_info/other_info/media_preview'

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

      <Link className={s.title} href={url} target="_blank">
        {title}
      </Link>
      <div className={s.arrowBox}>
        <ArrowSVG className={s.arrow} />
      </div>
    </div>
  )
}

export default MediaPreview
