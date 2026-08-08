import { createFileRoute } from '@tanstack/react-router'

import useTrans from '~/hooks/useTrans'

export const Route = createFileRoute('/$community/dash/doc/tree')({
  component: DocTreePage,
})

function DocTreePage() {
  const { t } = useTrans()

  return <h2>{t('dsb.page.doc.tree_todo')}</h2>
}
