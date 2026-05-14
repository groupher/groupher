import { COMMUNITY_LAYOUT } from '~/const/layout'
import type { TCommunityLayout } from '~/spec'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import SearchBox from '~/widgets/SearchBox'

import useSalon from './salon/search_box_view'

type TProps = {
  communityLayout: TCommunityLayout
  loading: boolean
}

export default function SearchBoxView({ communityLayout, loading }: TProps) {
  const s = useSalon()

  if (communityLayout === COMMUNITY_LAYOUT.SIDEBAR) {
    return <div className={s.wrapper}>{loading ? <LavaLampLoading /> : <SearchBox />}</div>
  }

  if (communityLayout === COMMUNITY_LAYOUT.CLASSIC) {
    return (
      <div className={s.wrapper}>
        {loading ? <LavaLampLoading top={4} right={12} /> : <SearchBox right={-4} />}
      </div>
    )
  }

  if (communityLayout === COMMUNITY_LAYOUT.HERO) {
    return (
      <div className={s.wrapper}>
        {loading ? <LavaLampLoading right={6} /> : <SearchBox right={6} />}
      </div>
    )
  }

  return null
}
