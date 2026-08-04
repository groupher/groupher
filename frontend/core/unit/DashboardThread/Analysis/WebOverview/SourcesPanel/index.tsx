import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import type { TAnalysisWebOverview } from '../spec'
import useSalon from './salon'

type TProps = {
  data: TAnalysisWebOverview['sources']
}

export default function SourcesPanel({ data }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        tabs={[
          { key: 'referrer', label: WEB_OVERVIEW_TEXT.referrers, items: data.referrer },
          { key: 'channel', label: WEB_OVERVIEW_TEXT.channels, items: data.channel },
          { key: 'domain', label: WEB_OVERVIEW_TEXT.domains, items: data.domain },
        ]}
        title={WEB_OVERVIEW_TEXT.sources}
      />
    </div>
  )
}
