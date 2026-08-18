'use client'

import useTrans from '~/hooks/useTrans'

export default function DashboardDocGitSyncPage() {
  const { t } = useTrans()

  return <div>{t('dsb.page.doc.git_sync')}</div>
}
