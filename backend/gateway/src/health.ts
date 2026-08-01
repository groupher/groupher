import { createHealthResponse } from '@groupher/service/health'

export const buildHealthResponse = () => createHealthResponse({ service: 'gateway' })
