import useSalon from '../salon/cover/placeholder'

import UploadSVG from '~/icons/Upload'

export default () => {
  const s = useSalon()

  return (
    <>
      <UploadSVG className={s.uploadIcon} />
      <div className={s.title}>上传封面图</div>
      <div className={s.desc}>上传本地图片或 URL, 默认展示为 680x400 宽度</div>
    </>
  )
}
