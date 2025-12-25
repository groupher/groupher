import dynamic from 'next/dynamic'

export default dynamic(() => import('./RealThemeSwitch'), {
  ssr: false,
})
