/**
 * Validates Gate action metadata against the registered thread catalog.
 *
 * @param {unknown} source Parsed Gate contract object to validate.
 * @param {readonly string[]} knownThreads Registered CMS thread values.
 * @returns {string[]} Validation findings; an empty array means the contract is valid.
 */
export function validateGateContract(source, knownThreads) {
  if (
    !source ||
    Object.keys(source).join(',') !== 'permissions' ||
    !Array.isArray(source.permissions)
  )
    throw new Error('expected permissions array only')
  const entries = new Map(),
    generatedKeys = new Set()
  for (const item of source.permissions) {
    if (
      !item ||
      Object.keys(item).sort().join(',') !==
        'action,grantable,owner_only,requires,requires_thread,scope'
    )
      throw new Error('invalid entry shape')
    const { action, scope, grantable, owner_only, requires, requires_thread } = item
    if (typeof action !== 'string' || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(action))
      throw new Error(`invalid action ${action}`)
    const generated = action.replaceAll('.', '_')
    if (entries.has(action) || generatedKeys.has(generated))
      throw new Error(`duplicate action or generated key ${action}`)
    if (
      !['global', 'community', 'article'].includes(scope) ||
      typeof grantable !== 'boolean' ||
      typeof owner_only !== 'boolean' ||
      !Array.isArray(requires) ||
      requires.some((dependency) => typeof dependency !== 'string') ||
      !requires_thread ||
      typeof requires_thread !== 'object' ||
      Array.isArray(requires_thread)
    )
      throw new Error(`invalid metadata ${action}`)
    if (new Set(requires).size !== requires.length)
      throw new Error(`duplicate dependency ${action}`)
    entries.set(action, item)
    generatedKeys.add(generated)
  }
  for (const item of entries.values()) {
    for (const [thread, deps] of Object.entries(item.requires_thread)) {
      if (
        !knownThreads.has(thread) ||
        !Array.isArray(deps) ||
        deps.some((dependency) => typeof dependency !== 'string') ||
        new Set(deps).size !== deps.length
      )
        throw new Error(`invalid thread dependency ${item.action}:${thread}`)
    }
    for (const dep of [...item.requires, ...Object.values(item.requires_thread).flat()]) {
      if (!entries.has(dep) || entries.get(dep).scope !== item.scope || dep === item.action)
        throw new Error(`invalid dependency ${item.action}:${dep}`)
    }
  }
  const active = new Set(),
    done = new Set()
  function visit(action) {
    if (active.has(action)) throw new Error(`dependency cycle ${action}`)
    if (done.has(action)) return
    active.add(action)
    const item = entries.get(action)
    for (const dep of [...item.requires, ...Object.values(item.requires_thread).flat()]) visit(dep)
    active.delete(action)
    done.add(action)
  }
  for (const action of entries.keys()) visit(action)
  return source.permissions
}
