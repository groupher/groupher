import { sortByIndex } from '~/helper'
import useTrans from '~/hooks/useTrans'
import type { TMediaReport } from '~/spec'
import AddButton from '~/widgets/Buttons/AddButton'
import useBaseInfo from '../../logic/useBaseInfo'

import useSalon from '../../salon/basic_info/other_info/media_editor'
import InputBox from './InputBox'

export default function MediaEditor() {
  const s = useSalon()
  const { addMediaReport, mediaReports, queryingMediaReportIndex } = useBaseInfo()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>
        {t('dsb.base_info.media.label')}
        <div className='grow' />
        <AddButton onClick={addMediaReport} dimWhenIdle>
          {t('dsb.base_info.media.add')}
        </AddButton>
      </div>
      {sortByIndex(mediaReports).map((item: TMediaReport) => (
        <InputBox
          key={item.index}
          item={item}
          queryingMediaReportIndex={queryingMediaReportIndex}
        />
      ))}
    </div>
  )
}
