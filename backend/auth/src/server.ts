/**
 * Production Node entrypoint: development login modules are absent from this graph.
 *
 * Business position:
 *   Production Node entrypoint -> standard Auth app -> HTTP listener
 */
import './env'
import { createApp } from './app'
import { startAuthServer } from './node-server'

startAuthServer(createApp())
