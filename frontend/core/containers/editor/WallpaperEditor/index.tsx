/* *
 * WallpaperEditor
 *
 */

import VIEW from '~/const/view'

import useMount from '~/hooks/useMount'
import Tabs from '~/widgets/Switcher/Tabs'
import BuildIn from './BuildIn'
import { TAB, TAB_OPTIONS } from './constant'
import Footer from './Footer'
import useSalon from './salon'
import UploadPic from './UploadPic'
import useLogic from './useLogic'

export default () => {
  const s = useSalon()
  const { tab, changeTab, initRollback } = useLogic()

  useMount(initRollback)

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <h3 className={s.title}>壁纸设置</h3>
        <Tabs items={TAB_OPTIONS} activeKey={tab} onChange={changeTab} view={VIEW.DRAWER} />
      </div>

      <div className={s.content}>
        {tab === TAB.BUILD_IN && <BuildIn />}
        {tab === TAB.UPLOAD && <UploadPic />}
      </div>

      <Footer />
    </div>
  )
}
