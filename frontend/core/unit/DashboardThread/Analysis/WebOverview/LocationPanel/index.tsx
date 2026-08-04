import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import type { TAnalysisWebOverview } from '../spec'
import useSalon from './salon'

type TProps = {
  data: TAnalysisWebOverview['location']
}

export default function LocationPanel({ data }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        tabs={[
          { key: 'country', label: WEB_OVERVIEW_TEXT.countries, items: data.country },
          { key: 'region', label: WEB_OVERVIEW_TEXT.regions, items: data.region },
          { key: 'city', label: WEB_OVERVIEW_TEXT.cities, items: data.city },
        ]}
        title={WEB_OVERVIEW_TEXT.location}
      />
    </div>
  )
}
