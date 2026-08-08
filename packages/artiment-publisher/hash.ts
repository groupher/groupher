import { createHash } from 'node:crypto'

/** Hashes canonical semantic Plate JSON into the BodyBag identity baseline. */
export const createBodyHash = (canonicalJson: string): string =>
  createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
