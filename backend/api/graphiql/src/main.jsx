import { createTransport } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import 'graphiql/setup-workers/vite'

import 'graphiql/style.css'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

const transport = createTransport({
  url: '/graphql',
  headers: { 'x-groupher-csrf': '1' },
  supportedMethods: ['POST'],
})

createRoot(document.getElementById('root')).render(createElement(GraphiQL, { transport }))
