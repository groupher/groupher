import { DOC_EDITOR_CONTENT_BOTTOM_RESERVE } from '../../salon/layout'

export default function useSalon() {
  return {
    wrapper: `column-start col-start-1 row-start-1 w-full max-w-none min-h-96 ${DOC_EDITOR_CONTENT_BOTTOM_RESERVE}`,
    error: 'mt-6 mb-8 text-xs text-red-500',
  }
}
