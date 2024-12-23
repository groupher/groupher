import { type FC, Suspense, memo } from 'react'

import TYPE from '~/const/type'
import { LoadWatcher } from '~/widgets/Common'
// import ModeLineMenu from '~/containers/unit/ModeLineMenu'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import ArticleViewer from '~/containers/viewer/ArticleViewer'

import {
  // ArticleViewer,
  TagSettingEditor,
  PassportEditor,
  ArticleEditor,
  WallpaperEditor,
  // MailsViewer,
} from './dynamic'

import UserList from '~/widgets/UserList'
import SearchPanel from '~/widgets/SearchPanel'

type TProps = {
  type: string
  onLoad: () => void
}

const Loading = () => {
  return <LavaLampLoading top={30} left={30} />
}

const Content: FC<TProps> = ({ type, onLoad }) => {
  if (!type) return <Loading />

  const { DRAWER } = TYPE

  switch (type) {
    case DRAWER.SEARCH_PANEL:
      return (
        <Suspense fallback={<Loading />}>
          <SearchPanel />
        </Suspense>
      )

    case DRAWER.PASSPORT_EDITOR:
      return (
        <Suspense fallback={<Loading />}>
          <PassportEditor />
        </Suspense>
      )

    case DRAWER.G_EDITOR:
      return (
        <Suspense fallback={<Loading />}>
          <ArticleEditor />
        </Suspense>
      )

    // case DRAWER.MAILS_VIEW:
    //   return <MailsViewer />

    case DRAWER.CUSTOM_BG_EDITOR:
      return (
        <Suspense fallback={<Loading />}>
          <WallpaperEditor />
        </Suspense>
      )

    case DRAWER.MODELINE_MENU:
      return null

    case DRAWER.LIST_USERS: {
      return (
        <Suspense fallback={<Loading />}>
          <UserList />
        </Suspense>
      )
    }

    case DRAWER.CREATE_TAG: {
      return (
        <Suspense fallback={<Loading />}>
          <TagSettingEditor mode="create" />
        </Suspense>
      )
    }

    case DRAWER.EDIT_TAG: {
      return (
        <Suspense fallback={<Loading />}>
          <TagSettingEditor />
        </Suspense>
      )
    }

    default: {
      return (
        <Suspense fallback={<Loading />}>
          <ArticleViewer />
          {/* to notify useOverlayScrollbars the dynamic loaded component is ready *
          OverlayScrollbars 插件在第一次初始化 dynamic Comp 时会出错，相当恶心  */}
          <LoadWatcher onLoad={onLoad} />
        </Suspense>
      )
    }
  }
}

export default memo(Content)
