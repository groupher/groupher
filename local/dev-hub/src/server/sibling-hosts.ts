import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import type { TEnvironment } from './environment-registry.ts'
import type { TServiceDefinition } from './services.ts'
import { userDataRoot } from './storage-paths.ts'

const digest = (input: string) => createHash('sha256').update(input).digest('hex')

/** Generate only the local sibling names owned by a registered environment. */
export function siblingHostnames(environment: TEnvironment, definitions: TServiceDefinition[]) {
  if (environment.role !== 'secondary' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(environment.slug))
    throw new Error('A registered secondary environment is required.')
  const names = new Set<string>()
  for (const service of definitions) {
    for (const endpoint of [service, ...(service.endpoints || [])]) {
      if (!endpoint.portlessUrl) continue
      const url = new URL(endpoint.portlessUrl)
      if (url.protocol !== 'https:' || !/(^|\.)groupher\.localhost$/.test(url.hostname))
        throw new Error('Unexpected Portless host in service definitions.')
      names.add(
        url.hostname.replace(/groupher\.localhost$/, `groupher-${environment.slug}.localhost`),
      )
    }
  }
  return [...names].sort()
}

/** Replace only the selected environment's marker block and reject external conflicts. */
export function prepareSiblingHosts(
  contents: string,
  slug: string,
  names: string[],
  remove = false,
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !names.length)
    throw new Error('Invalid sibling hosts configuration.')
  const expectedSuffix = `groupher-${slug}.localhost`
  if (
    names.some(
      (name) =>
        !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.localhost$/.test(name) ||
        (name !== expectedSuffix && !name.endsWith(`.${expectedSuffix}`)),
    )
  )
    throw new Error('Hosts contain names outside the registered environment.')
  const begin = `# groupher-devhub:begin ${slug}`
  const end = `# groupher-devhub:end ${slug}`
  const lines = contents.split('\n')
  const starts = lines.flatMap((line, index) => (line === begin ? [index] : []))
  const ends = lines.flatMap((line, index) => (line === end ? [index] : []))
  if (starts.length !== ends.length || starts.length > 1 || (starts.length && starts[0] >= ends[0]))
    throw new Error('Sibling hosts marker block is malformed; preserve it for diagnosis.')
  const outside = lines.filter((_, index) => !starts.length || index < starts[0] || index > ends[0])
  const before = starts.length ? lines.slice(starts[0], ends[0] + 1) : []
  for (const line of outside) {
    const hosts = line.split('#')[0].trim().split(/\s+/).slice(1)
    if (hosts.some((host) => names.includes(host.toLowerCase().replace(/\.$/, ''))))
      throw new Error('A sibling hostname is already present outside its managed hosts block.')
  }
  const block = [begin, ...names.map((name) => `127.0.0.1 ${name}`), end]
  if (starts.length) lines.splice(starts[0], ends[0] - starts[0] + 1, ...(remove ? [] : block))
  else if (!remove) {
    if (lines.at(-1) === '') lines.pop()
    if (lines.length) lines.push('')
    lines.push(...block, '')
  }
  return { contents: lines.join('\n'), before, block: remove ? [] : block }
}

const privilegedWriter = `
import hashlib, os, pathlib, stat, sys, uuid
hosts = pathlib.Path('/etc/hosts')
expected, staged, staged_hash = sys.argv[1:]
if hosts.is_symlink():
    raise SystemExit('hosts file is a symlink; no changes written')
current = hosts.read_bytes()
replacement = pathlib.Path(staged).read_bytes()
if hashlib.sha256(current).hexdigest() != expected:
    raise SystemExit('hosts changed after preview; no changes written')
if hashlib.sha256(replacement).hexdigest() != staged_hash:
    raise SystemExit('staged hosts content changed; no changes written')
info = hosts.stat()
temporary = hosts.with_name('.groupher-hosts-' + uuid.uuid4().hex)
try:
    fd = os.open(str(temporary), os.O_WRONLY | os.O_CREAT | os.O_EXCL, stat.S_IMODE(info.st_mode))
    with os.fdopen(fd, 'wb') as out:
        os.fchown(out.fileno(), info.st_uid, info.st_gid)
        out.write(replacement)
        out.flush()
        os.fsync(out.fileno())
    if hashlib.sha256(hosts.read_bytes()).hexdigest() != expected:
        raise SystemExit('hosts changed during setup; no changes written')
    os.replace(str(temporary), str(hosts))
finally:
    temporary.unlink(missing_ok=True)
`

/** Preview and back up /etc/hosts before a scoped, interactive privileged write. */
export async function setupSiblingHosts(
  environment: TEnvironment,
  definitions: TServiceDefinition[],
  remove = false,
): Promise<{ updated: boolean; backup?: string }> {
  const names = siblingHostnames(environment, definitions)
  if (!process.stdin.isTTY) throw new Error('Sibling hosts setup requires an interactive terminal.')
  const original = await readFile('/etc/hosts', 'utf8')
  const prepared = prepareSiblingHosts(original, environment.slug, names, remove)
  if (prepared.contents === original) return { updated: false }
  const directory = path.join(userDataRoot(environment.root), 'hosts-backups')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const id = randomUUID()
  const backup = path.join(directory, `hosts-${id}.bak`)
  const staged = path.join(directory, `hosts-${id}.new`)
  for (const [filename, content] of [
    [backup, original],
    [staged, prepared.contents],
  ]) {
    const file = await open(filename, 'wx', 0o600)
    try {
      await file.writeFile(content)
      await file.sync()
    } finally {
      await file.close()
    }
  }
  console.log(
    `Hosts backup: ${backup}\n${prepared.before.map((line) => `- ${line}`).join('\n')}\n${prepared.block.map((line) => `+ ${line}`).join('\n')}`,
  )
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'sudo',
        [
          '/usr/bin/python3',
          '-c',
          privilegedWriter,
          digest(original),
          staged,
          digest(prepared.contents),
        ],
        {
          stdio: 'inherit',
        },
      )
      child.once('error', reject)
      child.once('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Hosts update was not applied.')),
      )
    })
    return { updated: true, backup }
  } finally {
    await rm(staged, { force: true })
  }
}
