import { sortByIndex } from '~/helper'

import type { TMediaReport } from '~/spec'
import AddButton from '~/widgets/Buttons/AddButton'
import useBaseInfo from '../../logic/useBaseInfo'

import useSalon from '../../salon/basic_info/other_info/media_editor'
import InputBox from './InputBox'

export default () => {
  const s = useSalon()
  const { addMediaReport, mediaReports, queryingMediaReportIndex } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>
        媒体报道
        <div className='grow' />
        <AddButton onClick={addMediaReport} dimWhenIdle>
          添加
        </AddButton>
      </div>
      {/* @ts-ignore */}
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
