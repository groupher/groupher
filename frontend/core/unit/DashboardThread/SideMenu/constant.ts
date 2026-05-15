import { DSB_DOC_ROUTE } from '~/const/route'

export const DOC_MENU_ITEMS = [
  {
    title: 'dsb.menu.doc.layout',
    slug: DSB_DOC_ROUTE.LAYOUT,
    path: '',
  },
  {
    title: 'dsb.menu.doc.editor',
    slug: DSB_DOC_ROUTE.EDITOR,
    path: DSB_DOC_ROUTE.EDITOR,
  },
  {
    title: 'dsb.menu.doc.faq',
    slug: DSB_DOC_ROUTE.FAQ,
    path: DSB_DOC_ROUTE.FAQ,
  },
  {
    title: 'dsb.menu.doc.import_export',
    slug: DSB_DOC_ROUTE.IMPORT_EXPORT,
    path: DSB_DOC_ROUTE.IMPORT_EXPORT,
  },
] as const
