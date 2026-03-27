import ChangelogPreviewAdapter from './ChangelogPreviewAdapter'

export default async function Layout({ children, previewer }) {
  return (
    <>
      {children}
      <ChangelogPreviewAdapter>{previewer}</ChangelogPreviewAdapter>
    </>
  )
}
