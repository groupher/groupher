'use client'

import Link from 'next/link'

import { DSB_SEG } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import PinSVG from '~/icons/Pin'
import type { TDsbCoversConfig } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import { Portal } from '~/unit/DashboardThread'

import useSalon, { cn } from './salon'

const joinPath = (...parts: string[]) =>
  '/' + parts.flatMap((p) => (p ? [p.replace(/^\/+|\/+$/g, '')] : [])).join('/')

type Props = {
  config: TDsbCoversConfig
}

export default function DsbCovers({ config }: Props) {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()

  const buildHref = (seg: string) => joinPath(slug, DSB_SEG, seg)

  return (
    <div className={s.wrapper}>
      <Portal title={config.title} desc={config.desc} withDivider />

      <div className={s.groups}>
        {config.items.map((group) => (
          <section key={group.groupTitle} className={s.group}>
            <div className={s.groupHeader}>
              <h4 className={s.groupTitle}>{group.groupTitle}</h4>
            </div>

            <div className={s.content}>
              {group.items.map((it) => {
                const pinned = Boolean(it.pinned)

                return (
                  <Link
                    key={`${group.groupTitle}:${it.seg}`}
                    className={s.block}
                    href={buildHref(it.seg)}
                  >
                    <button
                      type='button'
                      className={cn(s.pinBtn, pinned && s.pinBtnActive)}
                      aria-pressed={pinned}
                      aria-label={pinned ? t('dsb.covers.unpin') : t('dsb.covers.pin')}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        config.onTogglePin?.(it.seg, !pinned)
                      }}
                    >
                      <PinSVG className={cn(s.pinIcon, pinned && s.pinIconActive)} />
                    </button>

                    {it.Icon ? <it.Icon className={s.icon} /> : null}

                    <div className='mt-auto'>
                      <div className={s.title}>{it.title}</div>
                      <p className={s.desc}>{it.desc}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
