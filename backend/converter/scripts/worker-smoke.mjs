/**
 * Converter Cloudflare runtime boundary.
 *
 * fixture files -> HTTP multipart -> converter assertions
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

const baseUrl = process.env.CONVERTER_BASE_URL ?? 'http://127.0.0.1:8000'
const fixtures = [
  ['sample.docx', 'POC Heading'],
  ['sample.pptx', 'POC Slide Heading'],
  ['sample.xlsx', 'POC Spreadsheet Cell'],
]

const upload = async (filename, bytes, contentType) => {
  const form = new FormData()
  form.set('file', new File([bytes], filename, { type: contentType }))
  return fetch(`${baseUrl}/convert`, { method: 'POST', body: form })
}

for (const [filename, expectedText] of fixtures) {
  const bytes = await readFile(new URL(`../fixtures/${filename}`, import.meta.url))
  const startedAt = performance.now()
  const response = await upload(filename, bytes, 'application/octet-stream')
  const elapsedMs = Math.round(performance.now() - startedAt)
  const body = await response.json()
  assert.equal(response.status, 200, `${filename} returned ${response.status}`)
  assert.match(body.markdown, new RegExp(expectedText))
  assert.equal(body.source.filename, filename)
  assert.ok(Array.isArray(body.diagnostics))
  console.log(`${filename}: ${response.status}, ${bytes.byteLength} bytes, ${elapsedMs} ms`)
}

for (const [filename, type] of [
  ['sample.pdf', 'application/pdf'],
  ['sample.html', 'text/html'],
  ['sample.htm', 'text/html'],
]) {
  const response = await upload(filename, new TextEncoder().encode('<h1>Not converted</h1>'), type)
  const body = await response.json()
  assert.equal(response.status, 415, `${filename} returned ${response.status}`)
  assert.equal(body.diagnostics?.[0]?.code, 'unsupported_extension')
  console.log(`${filename}: ${response.status} unsupported_extension`)
}

const malformed = await upload(
  'broken.docx',
  new TextEncoder().encode('not an OOXML archive'),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
)
assert.equal(malformed.status, 422)
assert.equal((await malformed.json()).diagnostics?.[0]?.code, 'invalid_file_content')

const oversized = await upload(
  'oversized.docx',
  new Uint8Array(25 * 1024 * 1024 + 1),
  'application/octet-stream',
)
assert.equal(oversized.status, 413)
assert.equal((await oversized.json()).diagnostics?.[0]?.code, 'file_too_large')

const burstStartedAt = performance.now()
const burst = await Promise.all(
  Array.from({ length: 6 }, async (_, index) => {
    const [filename] = fixtures[index % fixtures.length]
    const bytes = await readFile(new URL(`../fixtures/${filename}`, import.meta.url))
    const response = await upload(filename, bytes, 'application/octet-stream')
    assert.equal(response.status, 200, `concurrent ${filename} returned ${response.status}`)
    return response.json()
  }),
)
assert.equal(burst.length, 6)
console.log(`6-request burst: ${Math.round(performance.now() - burstStartedAt)} ms total`)

const health = await fetch(`${baseUrl}/health`)
assert.equal(health.status, 200)
console.log('health: 200 after positive, negative, size-limit, and concurrency cases')
