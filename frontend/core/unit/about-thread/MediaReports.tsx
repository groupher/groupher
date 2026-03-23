import Link from 'next/link'
import type { FC } from 'react'
import { sortByIndex } from '~/helper'
import Img from '~/Img'
import ArrowSVG from '~/icons/ArrowUpRight'
import type { TMediaReport } from '~/spec'

import useSalon from './salon/media_reports'

type TProps = {
  items: readonly TMediaReport[]
}

const MediaReports: FC<TProps> = ({ items }) => {
  const s = useSalon()

  return (
    <>
      {sortByIndex(items).map((item: TMediaReport) => {
        const { favicon, title, url, siteName } = item
        if (!title) return null

        return (
          <div className={s.preview} key={url}>
            <div className={s.brand}>
              <Img src={favicon} className={s.favicon} />
              <div className={s.siteName}>{siteName}</div>
            </div>

            <Link href={url} target='_blank' className={s.title}>
              {title}
            </Link>
            <div className={s.arrowBox}>
              <ArrowSVG className={s.arrowIcon} />
            </div>
          </div>
        )
      })}
    </>
  )
}

export default MediaReports
