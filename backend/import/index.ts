/**
 * Publishes the . boundary used by Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export { default } from './cf-worker'
export { createApp } from './src/app'
