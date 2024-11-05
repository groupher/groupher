/*
 *
 * CommunityEditor
 *
 */

import { useEffect } from 'react'

import Header from './Header'
import Banner from './Banner'
import Content from './Content'

import useLogic from './useLogic'
import useSalon from './salon'

export default () => {
  const s = useSalon()
  const { checkPendingApply } = useLogic()

  useEffect(() => {
    // checkPendingApply()
  }, [checkPendingApply])

  return (
    <div className={s.wrapper}>
      <Header />
      <div className={s.main}>
        <Banner />
        <Content />
      </div>
    </div>
  )
}
