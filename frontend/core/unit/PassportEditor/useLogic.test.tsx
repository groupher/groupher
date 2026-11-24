import { act, renderHook, waitFor } from '@testing-library/react'

import useLogic from './useLogic'

const state = vi.hoisted(() => ({
  activeAdmin: {
    memberId: 'member-1',
    revision: 5,
    isLord: false,
    permissions: ['audit.read'],
    user: { login: 'admin' },
  },
  canManage: true,
  updatePermissions: vi.fn(),
  removeAdmin: vi.fn(),
}))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/stores/dsbShell/editor', () => ({
  useAdminEditor: () => ({ activeAdmin: state.activeAdmin }),
}))
vi.mock('~/hooks/useGate', () => ({
  default: () => ({ can: () => state.canManage }),
}))
vi.mock('../DsbThread/logic/useAdmins', () => ({
  default: () => ({
    activeAdmin: state.activeAdmin,
    updatePermissions: state.updatePermissions,
    removeAdmin: state.removeAdmin,
  }),
}))
vi.mock('~/signal', () => ({ closeDrawer: vi.fn() }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))

beforeEach(() => {
  state.canManage = true
  state.updatePermissions.mockReset()
  state.removeAdmin.mockReset()
})

it('edits canonical Community permissions with the selected Admin revision', async () => {
  const { result } = renderHook(() => useLogic())
  expect(result.current.selectedPermissions).toEqual(['audit.read'])
  expect(result.current.grantablePermissions).toContain('community.article.hide')
  act(() => result.current.toggleCheck('community.article.hide', true))
  await act(async () => result.current.updatePassport())
  await waitFor(() =>
    expect(state.updatePermissions).toHaveBeenCalledWith('member-1', 5, {
      'audit.read': true,
      'community.article.hide': true,
      'community.article.trash.read': true,
    }),
  )
})

it('fails closed for a lord target or when the current Passport cannot manage Admins', () => {
  state.activeAdmin = { ...state.activeAdmin, isLord: true }
  const lord = renderHook(() => useLogic())
  expect(lord.result.current.isReadonly).toBe(true)
  state.activeAdmin = { ...state.activeAdmin, isLord: false }
  state.canManage = false
  const unauthorized = renderHook(() => useLogic())
  expect(unauthorized.result.current.isReadonly).toBe(true)
})
