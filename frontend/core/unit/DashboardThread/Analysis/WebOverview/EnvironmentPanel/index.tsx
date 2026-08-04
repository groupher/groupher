import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import type { TAnalysisWebOverview } from '../spec'
import useSalon from './salon'

type TProps = {
  data: TAnalysisWebOverview['environment']
}

export default function EnvironmentPanel({ data }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        tabs={[
          { key: 'browser', label: WEB_OVERVIEW_TEXT.browsers, items: data.browser },
          { key: 'os', label: WEB_OVERVIEW_TEXT.os, items: data.os },
          { key: 'device', label: WEB_OVERVIEW_TEXT.devices, items: data.device },
        ]}
        title={WEB_OVERVIEW_TEXT.environment}
      />
    </div>
  )
}
