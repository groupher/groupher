import useSalon, { cn } from '../../salon/domain/custom/dns_table'
import type { TDnsRecord } from './constant'

type Props = {
  records: TDnsRecord[]
}

export default function DnsRecordsTable({ records }: Props) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <table className={s.table}>
        <thead className={s.thead}>
          <tr>
            <th className={s.th}>Type</th>
            <th className={s.th}>Host name</th>
            <th className={s.th}>Value</th>
          </tr>
        </thead>

        <tbody>
          {records.map((record) => (
            <tr key={record.type} className={s.tr}>
              <td className={s.td}>{record.type}</td>
              <td className={s.td}>{record.host}</td>
              <td className={cn(s.td, 'break-all')}>{record.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
