import { useRouter } from 'next/navigation'

import { DSB_DOC_ROUTE } from '~/const/route'
import VIEW from '~/const/view'
import useCommunity from '~/hooks/useCommunity'

import Tabs from '~/widgets/Switcher/Tabs'
import { DOC_TABS } from '../../constant'
// import useCMSInfo from '../../hooks/useCMSInfo'
import useDoc from '../../logic/useDoc'
import useSalon from '../../salon/cms/docs'
// import Cover from './Cover'
// import FAQ from './FAQ'
// import TableView from './Table'
// import TreeView from './Tree'

export default () => {
  const s = useSalon()
  const { edit } = useDoc()

  const router = useRouter()
  const { slug: community } = useCommunity()
  const docTab = DSB_DOC_ROUTE.TABLE

  return (
    <div className={s.wrapper}>
      <div className={s.tabs}>
        <Tabs
          items={DOC_TABS}
          activeKey={docTab}
          onChange={(tab) => {
            edit(tab, 'docTab')

            const targetPath =
              tab === DSB_DOC_ROUTE.TABLE
                ? `/${community}/dashboard/doc`
                : `/${community}/dashboard/doc/${tab}`

            router.push(targetPath)
          }}
          view={VIEW.DESKTOP}
          noAnimation
        />
      </div>

      {/* {docTab === DSB_DOC_ROUTE.TREE && <TreeView pagedDocs={pagedDocs} />}
      {docTab === DSB_DOC_ROUTE.TABLE && (
        <TableView
          pagedDocs={pagedDocs}
          loading={loading}
          batchSelectedIDs={[...batchSelectedIDs]}
        />
      )}
      {docTab === DSB_DOC_ROUTE.COVER && <Cover />}
      {docTab === DSB_DOC_ROUTE.FAQ && (
        <FAQ
          sections={faqSections}
          editingFAQIndex={editingFAQIndex}
          editingFAQ={editingFAQ}
          isTouched={isFaqSectionsTouched}
        />
      )} */}
    </div>
  )
}
