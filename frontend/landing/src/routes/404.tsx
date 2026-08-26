import { createFileRoute } from '@tanstack/react-router'

import NotFound from '../NotFound'

export const Route = createFileRoute('/404')({ component: NotFound })
