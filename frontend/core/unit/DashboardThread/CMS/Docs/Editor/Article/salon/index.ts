export default function useSalon() {
  return {
    wrapper: 'flex flex-col items-start w-full max-w-full min-h-96 pl-24',
    empty: 'mt-16 text-sm text-gray-500',
    saveBar: 'mt-6 mb-8 flex items-center gap-3',
    saveButton:
      'rounded bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40',
    slug: 'text-xs text-gray-500',
    error: 'text-xs text-red-500',
  }
}
