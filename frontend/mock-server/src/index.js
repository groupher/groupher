import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { addMocksToSchema } from '@graphql-tools/mock'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { createHandler } from 'graphql-http/lib/use/http'

import { mocks } from './mocks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = Number(process.env.MOCK_GRAPHQL_PORT ?? process.env.PORT ?? 4001)
const GRAPHQL_PATH = process.env.MOCK_GRAPHQL_PATH ?? '/graphiql'

const schemaPath = (() => {
  const envPath = process.env.SCHEMA_PATH
  if (envPath) return path.resolve(process.cwd(), envPath)

  const preferred = path.resolve(__dirname, '../schema.graphql')
  if (existsSync(preferred)) return preferred

  return path.resolve(__dirname, '../../main/graphql/schema.graphql')
})()

const typeDefs = readFileSync(schemaPath, 'utf8')
const schema = makeExecutableSchema({ typeDefs })
const mockedSchema = addMocksToSchema({ schema, mocks })

const handler = createHandler({
  schema: mockedSchema,
  onOperation(_req, args) {
    const op = args.operationName ?? 'anonymous'
    // eslint-disable-next-line no-console
    console.log(`[mock-graphql] ${op}`)
  },
})

const renderGraphiQL = (endpointPath) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>GraphQL Mock Console</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .wrap { padding: 16px; max-width: 1100px; margin: 0 auto; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
      textarea { width: 100%; min-height: 260px; padding: 12px; box-sizing: border-box; border: 1px solid #e5e7eb; border-radius: 8px; }
      pre { width: 100%; min-height: 260px; padding: 12px; box-sizing: border-box; background: #0b1020; color: #dbeafe; border-radius: 8px; overflow: auto; margin: 0; }
      .top { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      button { padding: 10px 12px; border-radius: 8px; border: 1px solid #111827; background: #111827; color: #fff; cursor: pointer; }
      button:disabled { opacity: .6; cursor: not-allowed; }
      .meta { color: #6b7280; font-size: 12px; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <div>
          <div><strong>Groupher Mock GraphQL</strong></div>
          <div class="meta">POST <code>${endpointPath}</code> · GET <code>/health</code></div>
        </div>
        <button id="run">Run</button>
      </div>

      <div class="row">
        <div>
          <div class="meta" style="margin: 0 0 6px 2px;">Query</div>
          <textarea id="query">query Demo {
  community(slug: "home") {
    slug
    title
  }
  pagedPosts(filter: { community: "home", page: 1 }) {
    totalCount
    entries {
      innerId
      title
    }
  }
}</textarea>
          <div class="meta" style="margin: 10px 0 6px 2px;">Variables (JSON)</div>
          <textarea id="vars" style="min-height: 120px;">{}</textarea>
        </div>
        <div>
          <div class="meta" style="margin: 0 0 6px 2px;">Response</div>
          <pre id="out">Ready.</pre>
        </div>
      </div>
    </div>

    <script>
      const endpoint = ${JSON.stringify(endpointPath)}
      const btn = document.getElementById('run')
      const queryEl = document.getElementById('query')
      const varsEl = document.getElementById('vars')
      const outEl = document.getElementById('out')

      const pretty = (v) => {
        try { return JSON.stringify(v, null, 2) } catch { return String(v) }
      }

      btn.addEventListener('click', async () => {
        btn.disabled = true
        outEl.textContent = 'Loading...'

        let variables = {}
        try {
          variables = JSON.parse(varsEl.value || '{}')
        } catch (e) {
          outEl.textContent = 'Variables JSON parse error: ' + e.message
          btn.disabled = false
          return
        }

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query: queryEl.value, variables }),
          })
          const json = await res.json()
          outEl.textContent = pretty(json)
        } catch (e) {
          outEl.textContent = 'Request failed: ' + e.message
        } finally {
          btn.disabled = false
        }
      })
    </script>
  </body>
</html>
`

const setCORS = (req, res) => {
  const origin = req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin ?? '*')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
}

createServer((req, res) => {
  setCORS(req, res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.url === '/health') {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.url?.startsWith(GRAPHQL_PATH)) {
    const url = new URL(req.url, `http://${req.headers.host ?? `localhost:${PORT}`}`)

    // Browser open "http://.../graphiql" will be a GET without query.
    // Provide a real GraphiQL UI instead of "Missing query".
    if (req.method === 'GET' && !url.searchParams.get('query')) {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end(renderGraphiQL(GRAPHQL_PATH))
      return
    }

    handler(req, res)
    return
  }

  if (req.method === 'GET' && req.url === '/') {
    res.statusCode = 200
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(
      [
        'Groupher GraphQL mock server',
        '',
        `- schema: ${schemaPath}`,
        `- graphql endpoint: http://localhost:${PORT}${GRAPHQL_PATH}`,
        `- health: http://localhost:${PORT}/health`,
      ].join('\n'),
    )
    return
  }

  res.statusCode = 404
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.end('Not Found')
}).listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock GraphQL server listening on http://localhost:${PORT}${GRAPHQL_PATH}`)
})
