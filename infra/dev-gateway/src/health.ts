/**
 * Builds the Dev Gateway response for the shared health.v1 contract.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Dev Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import { createHealthResponse } from '@groupher/service/health'

/** Builds health response from typed Dev Gateway inputs. */
export const buildHealthResponse = () => createHealthResponse({ service: 'dev-gateway' })
