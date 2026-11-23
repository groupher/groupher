/**
 * Hub-managed development entrypoint; never used by build/start or the Worker.
 *
 * Business position:
 *   Hub development environment -> local identity handler -> Auth app -> loopback listener
 */
import './env'
import { createApp } from './app'
import { localTestActorLogin, localTestActorsEnabled } from './local-test-actors'
import { startAuthServer } from './node-server'

if (!localTestActorsEnabled(process.env)) {
  throw new Error('Development Auth requires the local Dev Hub.')
}
startAuthServer(createApp({ testLogin: localTestActorLogin() }), { hostname: '127.0.0.1' })
