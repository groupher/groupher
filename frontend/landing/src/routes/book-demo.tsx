import { createFileRoute } from '@tanstack/react-router'

import BookDemo from '../widgets/BookDemo'

export const Route = createFileRoute('/book-demo')({ component: BookDemo })
