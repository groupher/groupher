/**
 * Builds the Gateway response for the shared health.v1 contract.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

import { createHealthResponse } from '@groupher/service/health'

/** Builds health response from typed gateway inputs. */
export const buildHealthResponse = () => createHealthResponse({ service: 'gateway' })
