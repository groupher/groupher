'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { graphqlQueryOptions } from '~/query'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DsbThread/schema/assets'

import type { TAssetStats } from '../spec'
import { STORAGE_RING_CIRCUMFERENCE, STORAGE_RING_RADIUS } from './constant'
import DetailModal from './DetailModal'
import useSalon from './salon'

export default function StorageUsageRing() {
  const s = useSalon()
  const [showDetail, setShowDetail] = useState(false)
  const { slug: community } = useCommunity()
  const { data } = useQuery(
    graphqlQueryOptions<{ communityAssetStats: TAssetStats }>(S.communityAssetStats, {
      community,
    }),
  )
  const stats = data?.communityAssetStats
  const used = stats?.storageBytes ?? 0
  const limit = stats?.storageLimitBytes ?? 0
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const offset = STORAGE_RING_CIRCUMFERENCE * (1 - percent / 100)

  return (
    <>
      <button
        type='button'
        className={s.wrapper}
        aria-label={`Storage usage ${percent}%`}
        onClick={() => setShowDetail(true)}
      >
        <div className={s.ring}>
          <svg className={s.svg} viewBox='0 0 52 52' aria-hidden='true'>
            <circle className={s.track} cx='26' cy='26' r={STORAGE_RING_RADIUS} strokeWidth='2' />
            <circle
              className={s.progress}
              cx='26'
              cy='26'
              r={STORAGE_RING_RADIUS}
              strokeDasharray={STORAGE_RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap='round'
              strokeWidth='4'
            />
          </svg>
          <span className={s.percent}>{percent}%</span>
        </div>
      </button>

      <DetailModal
        limit={limit}
        offset={offset}
        percent={percent}
        show={showDetail}
        used={used}
        onClose={() => setShowDetail(false)}
      />
    </>
  )
}
