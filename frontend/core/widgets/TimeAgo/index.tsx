import dynamic from 'next/dynamic'

export default dynamic(() => import('timeago-react'), {
  ssr: false,
})
