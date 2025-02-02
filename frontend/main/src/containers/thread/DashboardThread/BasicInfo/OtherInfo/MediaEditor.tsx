import { sortByIndex } from '~/helper'

import type { TMediaReport } from '~/spec'
import AddButton from '~/widgets/Buttons/AddButton'

import InputBox from './InputBox'

import useSalon from '../../salon/basic_info/other_info/media_editor'
import useBaseInfo from '../../logic/useBaseInfo'

export default () => {
  const s = useSalon()
  const { addMediaReport, mediaReports, queringMediaReportIndex } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      <div className={s.label}>
        媒体报道
        <div className="grow" />
        <AddButton onClick={addMediaReport} dimWhenIdle>
          添加
        </AddButton>
      </div>
      {/* @ts-ignore */}
      {sortByIndex(mediaReports).map((item: TMediaReport) => (
        <InputBox key={item.index} item={item} queringMediaReportIndex={queringMediaReportIndex} />
      ))}
    </div>
  )
}
