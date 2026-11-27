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
