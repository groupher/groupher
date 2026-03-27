import PostPreviewAdapter from './PostPreviewAdapter'

// app/post/layout.tsx
export default async function Layout({ children, previewer }) {
  return (
    <>
      {children}
      <PostPreviewAdapter>{previewer}</PostPreviewAdapter>
    </>
  )
}
