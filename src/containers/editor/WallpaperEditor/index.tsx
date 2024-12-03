/* *
 * WallpaperEditor
 *
 */

import { useEffect } from 'react'
import VIEW from '~/const/view'

import Tabs from '~/widgets/Switcher/Tabs'

import { TAB, TAB_OPTIONS } from './constant'

import BuildIn from './BuildIn'
import UploadPic from './UploadPic'
import Footer from './Footer'

import useLogic from './useLogic'
import useSalon from './styles'

export default () => {
  const s = useSalon()
  const { tab, changeTab, initRollback } = useLogic()

  useEffect(() => {
    initRollback()
  }, [])

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <h3 className={s.title}>壁纸设置</h3>
        <Tabs items={TAB_OPTIONS} activeKey={tab} onChange={changeTab} view={VIEW.DRAWER} />
      </div>

      <div className={s.content}>
        {tab === TAB.BUILDIN && <BuildIn />}
        {tab === TAB.UPLOAD && <UploadPic />}
      </div>

      <Footer />
    </div>
  )
}
