'use client'

import Link from 'next/link'
import { DSB_SEG } from '~/const/route'
import Portal from '~/containers/thread/DashboardThread/Portal'
import useCommunity from '~/hooks/useCommunity'
import type { TDsbCoversConfig } from '~/spec'
import useSalon from './salon'

const joinPath = (...parts: string[]) =>
  '/' +
  parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .join('/')

type Props = {
  config: TDsbCoversConfig
}

export default function DsbCovers({ config }: Props) {
  const s = useSalon()
  const { slug } = useCommunity() // e.g. 'home'

  const buildHref = (seg: string) => joinPath(slug, DSB_SEG, seg)

  return (
    <div className={s.wrapper}>
      <Portal title={config.title} desc={config.desc} withDivider={false} />

      <div className={s.content}>
        {config.items.map((it) => (
          <Link key={it.seg} className={s.block} href={buildHref(it.seg)}>
            {it.Icon ? <it.Icon className={s.icon} /> : null}
            <div className='mt-auto'>
              <div className={s.title}>{it.title}</div>
              <p className={s.desc}>{it.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
