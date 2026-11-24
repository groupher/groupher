import useSalon from './salon/import_issues'
import type { TContentImportIssue } from './spec'

/** Renders bounded per-document failed and skipped outcomes returned by the Job. */
export default function ImportIssues({ issues }: { issues: TContentImportIssue[] }) {
  const s = useSalon()

  if (issues.length === 0) return null

  return (
    <ul className={s.wrapper}>
      {issues.map((issue) => (
        <li className={s.item} key={`${issue.externalRef}:${issue.code}`}>
          <code className={s.path}>{issue.externalRef}</code>
          <span className={s.message}>{issue.message}</span>
        </li>
      ))}
    </ul>
  )
}
