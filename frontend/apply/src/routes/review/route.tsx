import { createFileRoute } from '@tanstack/react-router'

import ReviewerShell from '../../components/ReviewerShell'

export const Route = createFileRoute('/review')({ component: ReviewerShell })
