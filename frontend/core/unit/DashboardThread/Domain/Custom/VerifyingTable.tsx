import useSalon, { cn } from '../salon/custom/verifying_table'
import type { TVerifyingDomainRow } from './constant'

type Props = {
  rows: TVerifyingDomainRow[]
}

const getStatusText = (status: TVerifyingDomainRow['status']): string => {
  switch (status) {
    case 'verifying':
      return 'Verifying'
    case 'verified':
      return 'Verified'
    case 'failed':
      return 'Failed'
    default:
      return 'Verifying'
  }
}

const fmtAdded = (addedAt?: string | null): string => {
  return addedAt ? addedAt : '-'
}

export default function VerifyingTable({ rows }: Props) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <table className={s.table}>
        <thead className={s.thead}>
          <tr>
            <th className={cn(s.th, s.colUrl)}>URL</th>
            <th className={cn(s.th, s.colStatus)}>Status</th>
            <th className={cn(s.th, s.colAdded)}>Added</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.url} className={s.tr}>
              <td className={cn(s.td, s.url)}>{row.url}</td>

              <td className={cn(s.td, s.statusCell)}>
                <span
                  className={cn(
                    s.statusDot,
                    row.status === 'verifying' && s.dotVerifying,
                    row.status === 'verified' && s.dotVerified,
                    row.status === 'failed' && s.dotFailed,
                  )}
                  aria-hidden='true'
                />
                <span className={s.statusText}>{getStatusText(row.status)}</span>
              </td>

              <td className={cn(s.td, s.added)}>{fmtAdded(row.addedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
