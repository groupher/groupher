export default function useSalon() {
  return {
    wrapper: 'py-4',
    align: {
      start: 'justify-self-start text-left',
      center: 'justify-self-center text-center',
      end: 'justify-self-end text-right',
    },
    label: 'text-digest text-xs',
    value: 'text-title mt-2 text-2xl tabular-nums',
    positiveChange: 'mt-1 text-xs text-green-600 tabular-nums',
    negativeChange: 'mt-1 text-xs text-red-600 tabular-nums',
  }
}
