'use client'

import Drawer from '~/widgets/@Drawer'
import ArticleViewer from '~/containers/viewer/ArticleViewer'
// import { motion, useScroll } from 'motion/react'

//
export default function Page() {
  return (
    <Drawer>
      <ArticleViewer />
    </Drawer>
  )
}
