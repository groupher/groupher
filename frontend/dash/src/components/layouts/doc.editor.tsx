'use client'

import { ADD_TAB_BREADCRUMB_SLOT_ID } from '~/unit/DashboardThread/CMS/Docs/Editor/AddTabPortal'

import createDocLayout from './_shared/createDocLayout'

export default createDocLayout({
  breadcrumbAddon: <span id={ADD_TAB_BREADCRUMB_SLOT_ID} />,
  path: 'editor',
  title: 'dsb.doc.editor',
  crumbTitle: 'dsb.crumb.doc.editor',
  hideTitle: true,
  withBodyGap: false,
})
