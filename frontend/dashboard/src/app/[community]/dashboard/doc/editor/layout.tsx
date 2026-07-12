'use client'

import AddTabButton from '~/unit/DashboardThread/CMS/Docs/Editor/AddTabButton'

import createDocLayout from '../_shared/createDocLayout'

export default createDocLayout({
  breadcrumbAddon: <AddTabButton />,
  path: 'editor',
  title: 'dsb.doc.editor',
  crumbTitle: 'dsb.crumb.doc.editor',
  hideTitle: true,
  withBodyGap: false,
})
