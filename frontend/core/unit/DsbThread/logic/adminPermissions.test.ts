import { GATE_ACTION } from '@groupher/contracts/gate'

import { expandAdminPermissions } from './adminPermissions'

describe('expandAdminPermissions', () => {
  it('expands only static same-scope requirements and does not grant thread-specific permissions', () => {
    expect(expandAdminPermissions([GATE_ACTION.COMMUNITY_ARTICLE_HIDE])).toEqual({
      [GATE_ACTION.COMMUNITY_ARTICLE_HIDE]: true,
      [GATE_ACTION.COMMUNITY_ARTICLE_TRASH_READ]: true,
    })
  })

  it('ignores unknown, non-Community, and non-grantable actions', () => {
    expect(
      expandAdminPermissions([
        'unknown.permission',
        GATE_ACTION.ARTICLE_READ_DRAFT,
        GATE_ACTION.ADMIN_INVITE,
      ]),
    ).toEqual({})
  })
})
