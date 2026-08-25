/**
 * Publishes the . boundary used by Gateway.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

// Compatibility root entry for hosts that look for index.js.
export { default } from './dist/app.js'
