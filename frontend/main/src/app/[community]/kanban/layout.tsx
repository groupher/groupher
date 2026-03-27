import PostPreviewAdapter from '../post/PostPreviewAdapter'

export default async function Layout({ children, previewer }) {
  return (
    <>
      {children}
      <PostPreviewAdapter>{previewer}</PostPreviewAdapter>
    </>
  )
}
