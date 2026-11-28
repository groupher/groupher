/** Embed the serving instance in the document without allowing HTML/script injection. */
export function embedPageIdentity(
  html: string,
  identity: { instanceId: string; repoRoot: string },
): string {
  if (!html.includes('</head>')) throw new Error('Dev Hub page has no head element.')
  const json = JSON.stringify({
    instanceId: identity.instanceId,
    repoRoot: identity.repoRoot,
  }).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
  return html.replace(
    '</head>',
    `<script id="dev-hub-page-identity" type="application/json">${json}</script></head>`,
  )
}

/** Read the single identity embedded by a managed Hub page. */
export function extractPageIdentity(html: string): { instanceId: string; repoRoot: string } {
  const matches = [
    ...html.matchAll(
      /<script id="dev-hub-page-identity" type="application\/json">([^<]*)<\/script>/g,
    ),
  ]
  if (matches.length !== 1) throw new Error('The Hub page does not provide one instance identity.')
  const value: unknown = JSON.parse(matches[0][1])
  if (!value || typeof value !== 'object') throw new Error('The Hub page identity is invalid.')
  const identity = value as Record<string, unknown>
  if (
    typeof identity.instanceId !== 'string' ||
    !identity.instanceId ||
    typeof identity.repoRoot !== 'string' ||
    !identity.repoRoot
  )
    throw new Error('The Hub page identity is invalid.')
  return { instanceId: identity.instanceId, repoRoot: identity.repoRoot }
}
