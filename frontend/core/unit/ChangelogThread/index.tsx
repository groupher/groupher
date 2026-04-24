'use client'

/* *
 * ChangelogThread
 *
 */

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

import ClassicLayout from './ClassicLayout'
import SimpleLayout from './SimpleLayout'

export default function ChangelogThread() {
  const { communityLayout } = useLayout()

  return communityLayout === COMMUNITY_LAYOUT.HERO ? <ClassicLayout /> : <SimpleLayout />
}
