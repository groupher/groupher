import assert from 'node:assert/strict'
import test from 'node:test'

import { salonPropFindings } from './report-salon-props.mjs'

const scan = (source) => salonPropFindings('example.tsx', source)

test('reports the direct binding under different prop names', () => {
  const findings = scan(`function Parent() {
    const styles = useSalon({ active: true })
    return <Child s={styles} salon={styles} className={styles.wrapper} />
  }`)
  assert.deepEqual(
    findings.map(({ component, prop, binding }) => [component, prop, binding]),
    [
      ['Parent', 's', 'styles'],
      ['Parent', 'salon', 'styles'],
    ],
  )
})

test('resolves shadowed bindings instead of matching names', () => {
  assert.deepEqual(
    scan(`function Parent() {
    const s = useSalon()
    function Child({ s }: { s: string }) { return <Leaf s={s} /> }
    return <Child s="plain" />
  }`),
    [],
  )
})

test('respects block and loop shadowing', () => {
  const findings = scan(`function Parent() {
    const s = useSalon()
    { const s = {}; <Child s={s} /> }
    for (const s of items) { <Child s={s} /> }
    return <Child s={s} />
  }`)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].line, 5)
})

test('ignores ordinary bindings, individual values, aliases, and spreads', () => {
  assert.deepEqual(
    scan(`function Parent() {
    const s = useSalon()
    const alias = s
    const other = { s }
    return <><Child value={s.wrapper} {...other} /><Child s={alias} /></>
  }
  function Other() { const s = {}; return <Child s={s} /> }`),
    [],
  )
})

test('reports malformed source as a scan error', () => {
  assert.throws(() => scan('function Broken( { return <Child />'), /parse failed/)
})
