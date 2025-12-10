// src/app/tmp.tsx
'use client'

import { useArticleStore } from '~/stores/zustand'

export default function Tmp() {
  const articles = useArticleStore((state) => state.articles)

  return (
    <div className='absolute z-50 bg-white w-96 h-96 debug left-10'>
      <p>文章数量：{articles.pagedPosts?.totalCount}</p>
    </div>
  )
}
