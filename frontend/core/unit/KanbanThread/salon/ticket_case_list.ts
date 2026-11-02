export default function useSalon() {
  return {
    wrapper: 'border-divider space-y-4 rounded-xl border p-4',
    header: 'row-between border-divider border-b pb-3',
    title: 'font-semibold',
    count: 'text-digest text-sm',
    rows: 'divide-divider divide-y',
    row: 'flex flex-wrap items-center gap-3 py-3 hover:bg-hoverBg',
    status: 'text-digest rounded-md border px-2 py-1 text-xs',
    caseTitle: 'min-w-0 grow font-medium',
    muted: 'text-digest text-sm',
    footer: 'row-center gap-3',
  }
}
