/** Provides the publication review layout without coupling it to the workbench controls. */
export default function useSalon() {
  return {
    wrapper: 'space-y-4 p-6',
    content: 'max-h-96 space-y-4 overflow-y-auto',
    title: 'text-xl font-semibold',
    hint: 'text-digest mt-1 text-sm',
    head: 'border-divider space-y-2 rounded-lg border p-4',
    heading: 'font-semibold',
    summary: 'text-digest text-sm',
    body: 'whitespace-pre-wrap',
    updates: 'space-y-3',
    actions: 'flex justify-end gap-2',
  }
}
