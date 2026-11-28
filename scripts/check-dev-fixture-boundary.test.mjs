import assert from 'node:assert/strict'
import test from 'node:test'
import { fixtureBoundaryFindings } from './check-dev-fixture-boundary.mjs'

test('rejects direct and aliased internal calls and business table writes', () => {
  const source = `
alias CMS.Communities.Commands.Create, as: Create
alias GroupherServer.Repo, as: R
alias CMS.Communities, as: Communities
def run do
  CMS.Communities.Commands.Create.execute(input)
  Create.execute(input)
  Repo.delete(member)
  R.insert(member)
  R.delete member
  CMS.Communities.request_destroy(community)
  CMS.Passport.Catalog.validate_permissions(:community, %{})
  Communities.request_destroy(community)
end
`
  const findings = fixtureBoundaryFindings(source, 'seed/admin/invite.ex')
  assert.equal(findings.length, 8)
})

test('permits only the scoped tool write exception', () => {
  const source = 'defp store(binding, key, entry) do\n  Repo.update(binding)\nend'
  assert.deepEqual(fixtureBoundaryFindings(source, 'seed/admin/invite.ex'), [])
  assert.equal(fixtureBoundaryFindings(source, 'seed/admin/other.ex').length, 1)
})
