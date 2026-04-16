'use client'

/* *
 * ChangelogThread
 *
 */

import { BANNER_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

import ClassicLayout from './ClassicLayout'
import SimpleLayout from './SimpleLayout'

export default function ChangelogThread() {
  const { globalLayout } = useLayout()

  return globalLayout === BANNER_LAYOUT.TABBER ? <ClassicLayout /> : <SimpleLayout />
}
