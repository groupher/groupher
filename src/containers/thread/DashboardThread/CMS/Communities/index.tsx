import { type FC, useCallback, useState } from 'react'
import { pluck } from 'ramda'
import { Table, Column, HeaderCell, Cell } from 'rsuite-table'

import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import Checker from '~/widgets/Checker'

import { CheckCell, CommunityCell, PendingCell, TimestampCell } from '../Cell'
import FilterBar from '../FilterBar'

import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon from '../../salon/cms/communities'

/**
 * example: https://table.rsuitejs.com/#fixed-column
 * API: https://github.com/rsuite/rsuite-table#api
 */

const Communities: FC = () => {
  const s = useSalon()

  const { pagedCommunities, loading, batchSelectedIDs, batchSelectAll } = useCMSInfo()
  const [showCheckColumn, setShowCheckColumn] = useState(false)
  const [sortColumn, setSortColumn] = useState('id')

  const allIDs = pluck('id', pagedCommunities.entries)
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
        data={pagedCommunities.entries}
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

        <Column width={180} fixed>
          <HeaderCell>
            <div className={s.title}>名称</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <CommunityCell />
        </Column>

        <Column width={200} fixed>
          <HeaderCell align="left" renderSortIcon={() => renderSortIcon('commentsCount')}>
            <div className={s.title}>简介</div>
          </HeaderCell>
          <Cell dataKey="desc" align="left" />
        </Column>

        <Column width={90} fixed>
          <HeaderCell align="center">
            <div className={s.title}>状态</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <PendingCell />
        </Column>

        <Column width={65} sortable>
          <HeaderCell align="center" renderSortIcon={() => renderSortIcon('commentsCount')}>
            <div className={s.title}>关注</div>
          </HeaderCell>
          <Cell dataKey="subscribersCount" align="center" />
        </Column>

        <Column width={65} sortable>
          <HeaderCell align="center" renderSortIcon={() => renderSortIcon('views')}>
            <div className={s.title}>浏览</div>
          </HeaderCell>
          <Cell dataKey="views" align="center" />
        </Column>

        <Column width={60} sortable>
          <HeaderCell align="center" renderSortIcon={() => renderSortIcon('commentsCount')}>
            <div className={s.title}>内容</div>
          </HeaderCell>
          <Cell dataKey="articlesCount" align="center" />
        </Column>

        <Column width={100}>
          <HeaderCell align="right">
            <div className={s.title}>创建/更新</div>
          </HeaderCell>
          {/* @ts-ignore */}
          <TimestampCell />
        </Column>
      </Table>
    </>
  )
}

export default Communities
