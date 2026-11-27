import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

test(
  'fresh isolated home seed remains idempotent with managed development limits',
  { skip: process.env.GROUPHER_HOME_REHEARSAL !== '1', timeout: 600_000 },
  async () => {
    const checkout = path.resolve('../..')
    const backend = path.join(checkout, 'backend/api')
    const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'groupher-home-rehearsal-')))
    const data = path.join(temporary, 'postgres')
    const build = path.join(temporary, 'build')
    const run = `home-rehearsal-${path.basename(temporary).split('-').at(-1)!.toLowerCase()}`
    const evidence = path.join(checkout, '.playwright', run)
    const ledger = path.join(evidence, 'cleanup.md')
    const database = 'groupher_home_rehearsal'
    const server = createServer()
    let started = false
    let port = 0
    let outcome = 'not started'
    let cleanup = 'pending'
    let details = ''
    await mkdir(evidence, { recursive: true, mode: 0o700 })
    const save = () =>
      writeFile(
        ledger,
        `# Home rehearsal\n\n- HEAD: ${execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim()}\n- Target: disposable PostgreSQL 127.0.0.1:${port}/${database}\n- Temporary directory: ${temporary}\n- Result: ${outcome}\n- Cleanup: ${cleanup}\n\n${details}\n`,
        { mode: 0o600 },
      )
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      port = (server.address() as { port: number }).port
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await save()
      execFileSync('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-instructions'], {
        stdio: 'ignore',
      })
      execFileSync(
        'pg_ctl',
        [
          '-D',
          data,
          '-l',
          path.join(temporary, 'postgres.log'),
          '-o',
          `-h 127.0.0.1 -p ${port}`,
          '-w',
          'start',
        ],
        { stdio: 'ignore' },
      )
      started = true
      await mkdir(build, { recursive: true })
      await cp(path.join(backend, '_build/dev'), path.join(build, 'dev'), { recursive: true })
      const env: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        TMPDIR: process.env.TMPDIR,
        MIX_ENV: 'dev',
        MIX_BUILD_PATH: build,
        DB_NAME: database,
        DB_HOST: '127.0.0.1',
        DB_PORT: String(port),
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        NODE_ENV: 'development',
        DEV_HUB_MANAGED_ENVIRONMENT: 'true',
      }
      const mix = (args: string[]) =>
        execFileSync('mix', args, {
          cwd: backend,
          env,
          encoding: 'utf8',
          timeout: 240_000,
          maxBuffer: 32 * 1024 * 1024,
        })
      mix(['ecto.create', '--quiet'])
      const pgEnvironment = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('PG')),
      )
      const query = (db: string, sql: string) =>
        execFileSync(
          'psql',
          [
            '-X',
            '-qAt',
            '-v',
            'ON_ERROR_STOP=1',
            '-h',
            '127.0.0.1',
            '-p',
            String(port),
            '-U',
            'postgres',
            '-d',
            db,
            '-c',
            sql,
          ],
          { encoding: 'utf8', env: pgEnvironment },
        ).trim()
      assert.equal(query(database, 'SELECT current_database()'), database)
      const backup = path.join(temporary, 'empty.backup')
      execFileSync(
        'pg_dump',
        ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-Fc', '-f', backup, database],
        { env: pgEnvironment },
      )
      mix(['ecto.migrate'])
      const versions = query(database, 'SELECT count(*) FROM schema_migrations')
      const script = `
        Application.put_env(:groupher_server, GroupherServerWeb.Endpoint, Keyword.put(Application.get_env(:groupher_server, GroupherServerWeb.Endpoint, []), :server, false))
        Application.put_env(:groupher_server, Oban, Keyword.merge(Application.get_env(:groupher_server, Oban, []), testing: :manual, plugins: false, queues: false))
        Application.put_env(:groupher_server, :web_analysis_policy, provision_on_community_create: false)
        Application.put_env(:groupher_server, :search_artiments, Keyword.put(Application.get_env(:groupher_server, :search_artiments, []), :platform, GroupherServer.CMS.SearchArtiments.Disabled))
        {:ok, _} = Application.ensure_all_started(:groupher_server)
        Application.fetch_env!(:groupher_server, :cache) |> Keyword.fetch!(:pool) |> Enum.each(fn {key, %{name: name}} -> if is_nil(Process.whereis(name)), do: Cachex.start_link(name, Helper.Cache.config(key)) end)
        options = [wallpaper: false, command_id_factory: &Ecto.UUID.generate/0]
        {:ok, first} = GroupherServer.CMS.Seeds.LiteHome.seed(options)
        {:ok, second} = GroupherServer.CMS.Seeds.LiteHome.seed(options)
        if first.id != second.id, do: raise("home seed created a duplicate community")
        IO.puts("HOME_REHEARSAL_OK")
      `
      assert.match(mix(['run', '--no-start', '-e', script]), /HOME_REHEARSAL_OK/)
      query('postgres', 'CREATE DATABASE groupher_home_recovery')
      execFileSync(
        'pg_restore',
        [
          '-h',
          '127.0.0.1',
          '-p',
          String(port),
          '-U',
          'postgres',
          '-d',
          'groupher_home_recovery',
          backup,
        ],
        { stdio: 'ignore', env: pgEnvironment },
      )
      assert.equal(
        query(
          'groupher_home_recovery',
          "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')",
        ),
        '0',
      )
      outcome = 'passed: two home runs without wallpaper; clean baseline restored'
      details = `- Applied migration versions: ${versions}\n- Wallpaper callback: not tested\n- Migration source: current checkout including untracked migration files\n`
    } catch (error) {
      outcome = 'failed'
      details = `- Failure: ${error instanceof Error ? error.message.slice(0, 500) : 'unknown error'}\n`
      throw error
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()))
      try {
        if (started)
          execFileSync('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
        await rm(temporary, { recursive: true, force: true })
        cleanup = 'disposable cluster and build directory removed'
      } catch (error) {
        cleanup = 'failed; disposable directory retained for inspection'
        await save()
        throw error
      }
      await save()
    }
  },
)
