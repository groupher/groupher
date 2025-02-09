/* *
 * ChangelogThread
 *
 */

import { BANNER_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

import ClassicLayout from './ClassicLayout'
import SimpleLayout from './SimpleLayout'

export default () => {
  const { bannerLayout } = useLayout()

  return bannerLayout === BANNER_LAYOUT.TABBER ? <ClassicLayout /> : <SimpleLayout />
}
