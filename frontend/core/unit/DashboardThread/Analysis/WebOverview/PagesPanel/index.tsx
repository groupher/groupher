import { WEB_OVERVIEW_TEXT } from '../constant'
import DimensionPanel from '../DimensionPanel'
import type { TAnalysisWebOverview } from '../spec'
import useSalon from './salon'

type TProps = {
  data: TAnalysisWebOverview['pages']
}

export default function PagesPanel({ data }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DimensionPanel
        emptyLabel={WEB_OVERVIEW_TEXT.empty}
        metricKey='visitors'
        tabs={[
          { key: 'path', label: WEB_OVERVIEW_TEXT.path, items: data.path },
          { key: 'url', label: WEB_OVERVIEW_TEXT.url, items: data.url },
          { key: 'entry', label: WEB_OVERVIEW_TEXT.entryPage, items: data.entry },
          { key: 'exit', label: WEB_OVERVIEW_TEXT.exitPage, items: data.exit },
        ]}
        title={WEB_OVERVIEW_TEXT.pages}
      />
    </div>
  )
}
