import { lazy } from 'react'

// import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

export const ArticleEditor = lazy(() => import('~/containers/editor/ArticleEditor'))
// export const ArticleEditor = dynamic(() => import('~/containers/editor/ArticleEditor'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

export const WallpaperEditor = lazy(() => import('~/containers/editor/WallpaperEditor'))
// export const WallpaperEditor = dynamic(() => import('~/containers/editor/WallpaperEditor'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

// export const AccountEditor = lazy(() => import('~/containers/editor/AccountEditor'))

export const UserList = lazy(() => import('~/widgets/UserList'))
// export const UserList = dynamic(() => import('~/widgets/UserList'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

export const SearchPanel = lazy(() => import('~/widgets/SearchPanel'))
// export const SearchPanel = dynamic(() => import('~/widgets/SearchPanel'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

export const ArticleViewer = lazy(() => import('~/containers/viewer/ArticleViewer'))
// export const ArticleViewer = dynamic(() => import('~/containers/viewer/ArticleViewer'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

export const TagSettingEditor = lazy(() => import('~/containers/editor/TagSettingEditor'))
// export const TagSettingEditor = dynamic(() => import('~/containers/editor/TagSettingEditor'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })

export const PassportEditor = lazy(() => import('~/containers/editor/PassportEditor'))
// export const PassportEditor = dynamic(() => import('~/containers/editor/PassportEditor'), {
//   loading: () => <LavaLampLoading />,
//   ssr: false,
// })
