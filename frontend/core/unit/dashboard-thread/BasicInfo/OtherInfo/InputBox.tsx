import type { FC } from 'react'
import DeleteSVG from '~/icons/DeleteSolid'
import type { TMediaReport } from '~/spec'
import Input from '~/widgets/Input'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useTrans from '~/hooks/useTrans'
import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/other_info/input_box'
import MediaPreview from './MediaPreview'

type TProps = {
  item: TMediaReport
  queryingMediaReportIndex: number | null
}

const InputBox: FC<TProps> = ({ item, queryingMediaReportIndex }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { index, editUrl, title } = item
  const { removeMediaReport, mediaReportOnChange, queryOpenGraphInfo } = useBaseInfo()

  return (
    <div className={s.wrapper}>
      {index !== null && queryingMediaReportIndex === index && (
        <LavaLampLoading size='tiny' top={-2} />
      )}
      {title && <MediaPreview item={item} />}
      <div className={s.inputWrapper}>
        <Input
          value={editUrl}
          onChange={(e) => mediaReportOnChange(item.index, e.target.value)}
          onBlur={() => queryOpenGraphInfo(item)}
        />
        <DeleteSVG className={s.deleteIcon} onClick={() => removeMediaReport(index)} />
      </div>
      {editUrl && <div className='mb-5' />}
      {!editUrl && <p>{t('dsb.base_info.media.placeholder')}</p>}
    </div>
  )
}

export default InputBox
