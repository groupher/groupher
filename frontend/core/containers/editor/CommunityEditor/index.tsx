/*
 *
 * CommunityEditor
 *
 */

import { useEffect } from 'react'
import Banner from './Banner'
import Content from './Content'
import Header from './Header'
import useSalon from './salon'
// import useLogic from './useLogic'

export default function CommunityEditor() {
  const s = useSalon()
  // const { checkPendingApply } = useLogic()

  useEffect(() => {
    // checkPendingApply()
  }, [])

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
