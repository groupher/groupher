import { type FC, useCallback, useState } from 'react'
import { pluck } from 'ramda'

import { Table, Column, HeaderCell, Cell } from 'rsuite-table'

import type { TID, TPagedArticles } from '~/spec'

import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import Checker from '~/widgets/Checker'

import { CheckCell, ArticleCell, StateCell, AuthorDateCell, DateCell } from '../Cell'
import FilterBar from '../FilterBar'

import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon from '../../salon/cms/posts'

/**
 * example: https://table.rsuitejs.com/#fixed-column
 * API: https://github.com/rsuite/rsuite-table#api
 */

type TProps = {
  pagedDocs: TPagedArticles
  loading: boolean
  batchSelectedIDs: TID[]
}

const DocsTables: FC<TProps> = ({ pagedDocs, loading, batchSelectedIDs }) => {
  const s = useSalon()
  const { batchSelectAll } = useCMSInfo()

  const [showCheckColumn, setShowCheckColumn] = useState(false)
  const [sortColumn, setSortColumn] = useState('id')

  const allIDs = pluck('id', pagedDocs.entries)
  const isAllSelected = allIDs.length === batchSelectedIDs?.length

  const [sortState, setSortState] = useState({
    views: '', // '' / asc / desc
    commentsCount: '',
    upvotesCount: '',
  })

  const handleSortColumn = useCallback(
    (sortColumn, sortType) => {
      setSortColumn(sortColumn)
      setSortState({ ...sortState, [sortColumn]: sortType })
    },
    [sortState],
  )

  const renderSortIcon = useCallback(
    (sortColumn) => {
      const sortType = sortState[sortColumn]

      switch (sortType) {
        case 'asc': {
          return <ArrowSVG className={s.icon.arrowUp} />
        }
        case 'desc': {
          return <ArrowSVG className={s.icon.arrowDown} />
        }

        default:
          return <FilterSVG className={s.icon.filter} />
      }
    },
    [sortState],
  )

  return (
    <>
      <FilterBar
        checkboxActive={showCheckColumn}
        triggerCheckbox={(show) => setShowCheckColumn(show)}
        selectedCount={batchSelectedIDs.length}
      />
      <Table
        data={pagedDocs.entries}
        sortColumn={sortColumn}
        onSortColumn={handleSortColumn}
        rowHeight={68}
        loading={loading}
        hover={false}
        autoHeight
        cellBordered
        bordered
      >
        {showCheckColumn && (
          <Column width={40} fixed>
            <HeaderCell>
              <Checker
                checked={isAllSelected}
                size="small"
                top={4}
                onChange={(checked) => {
                  if (checked) {
                    batchSelectAll(true, allIDs)
                    return
                  }

                  batchSelectAll(false, [])
                }}
              />
            </HeaderCell>
            {/* @ts-ignore */}
            <CheckCell />
          </Column>
        )}

        <Column width={280} fixed>
          <HeaderCell>
            <div className={s.title}>标题</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <ArticleCell dataKey="title" />
        </Column>

        <Column width={90} fixed>
          <HeaderCell align="center">
            <div className={s.title}>状态</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <StateCell />
        </Column>

        <Column width={65} fixed sortable>
          <HeaderCell align="center" renderSortIcon={() => renderSortIcon('upvotesCount')}>
            <div className={s.title}>投票</div>
          </HeaderCell>
          <Cell dataKey="upvotesCount" align="center" />
        </Column>

        <Column width={65} sortable>
          <HeaderCell align="center" renderSortIcon={() => renderSortIcon('views')}>
            <div className={s.title}>浏览</div>
          </HeaderCell>
          <Cell dataKey="views" align="center" />
        </Column>

        <Column width={60} sortable>
          <HeaderCell align="center" renderSortIcon={() => renderSortIcon('commentsCount')}>
            <div className={s.title}>评论</div>
          </HeaderCell>
          <Cell dataKey="commentsCount" align="center" />
        </Column>

        <Column width={100}>
          <HeaderCell align="right">
            <div className={s.title}>发布/活跃</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <DateCell />
        </Column>

        <Column width={115}>
          <HeaderCell align="right">
            <div className={s.title}>作者</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <AuthorDateCell />
        </Column>
      </Table>
    </>
  )
}

export default DocsTables
