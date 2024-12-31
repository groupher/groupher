'use client'

import useSalon from '~/widgets/Article/salon/post'

const Layout = ({ children }) => {
  const s = useSalon()

  return <div className={s.wrapper}>{children}</div>
}

export default Layout
