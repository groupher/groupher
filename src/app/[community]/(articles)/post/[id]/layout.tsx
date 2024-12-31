'use client'

import useSalon from '~/widgets/Article/styles/post'

const Layout = ({ children }) => {
  const s = useSalon()

  return <div className={s.wrapper}>{children}</div>
}

export default Layout
