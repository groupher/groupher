#!/usr/bin/env python3
"""Reset approved obsolete content using an explicit, reviewed R8 table manifest.

Connection file -> identity/task/ownership checks -> transaction -> protected row
fingerprints -> explicit content reset -> identical protected fingerprints -> commit.
Secrets are read from a mode-0600 file and passed only through libpq environment.
Default mode is a read-only inventory; --apply is an explicit destructive action.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def table_name(value):
    if not re.fullmatch(r"[a-z_]+\.[a-z_]+", value):
        raise ValueError("Invalid manifest table name")
    return '.'.join('"' + part + '"' for part in value.split('.'))


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--connection-file', required=True)
    parser.add_argument('--expected-host', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    plan = json.loads(Path(__file__).with_name('docs-r8-content-reset-plan.json').read_text())
    connection = Path(args.connection_file)
    if connection.stat().st_mode & 0o077:
        raise RuntimeError('Connection file must not be accessible to group or other users')
    uri = urlsplit(connection.read_text().strip())
    if uri.hostname != args.expected_host or uri.path[1:] != plan['database']:
        raise RuntimeError('Explicit database/host identity does not match connection')
    env = dict(os.environ, PGHOST=uri.hostname, PGDATABASE=uri.path[1:],
               PGUSER=unquote(uri.username), PGPASSWORD=unquote(uri.password), PGSSLMODE='require')

    def query(sql):
        result = subprocess.run(['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
                                input=sql, env=env, text=True, capture_output=True)
        if result.returncode:
            # SQL errors contain no connection parameters, but still scrub the credential.
            error = result.stderr.replace(unquote(uri.password), '[redacted]')
            raise RuntimeError(error)
        return result.stdout

    tables = plan['truncate_tables']
    tables_sql = ','.join(table_name(table) for table in tables)
    outbox = ','.join(map(literal, plan['outbox_events']))
    receipts = ','.join(map(literal, plan['receipt_commands']))
    workers = ','.join(literal('GroupherServer.Jobs.' + worker) for worker in plan['retired_job_workers'])
    ignored = ','.join(map(literal, tables))
    # Preserve all rows outside the reviewed reset, including unrelated shared-queue history.
    protected_filter = {
        'cms.outbox_events': f'event NOT IN ({outbox})',
        'cms.command_receipts': f'command NOT IN ({receipts})',
        'public.oban_jobs': f'worker NOT IN ({workers})',
    }
    filters = ' '.join(f'WHEN {literal(table)} THEN {literal(where)}' for table, where in protected_filter.items())
    fingerprint = f"""
      FOR row IN SELECT schemaname,tablename FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog','information_schema')
          AND schemaname NOT LIKE 'pg_temp_%%'
          AND schemaname||'.'||tablename NOT IN ({ignored})
        ORDER BY schemaname,tablename LOOP
        name := row.schemaname||'.'||row.tablename;
        predicate := CASE name {filters} ELSE 'true' END;
        expression := 'to_jsonb(t)';
        IF name='account.users' THEN
          expression := $expr$to_jsonb(t) - 'meta' || jsonb_build_object('meta',
            (SELECT coalesce(jsonb_object_agg(key,value),'{{}}'::jsonb)
             FROM jsonb_each(CASE WHEN jsonb_typeof(to_jsonb(t)->'meta')='object' THEN to_jsonb(t)->'meta' ELSE '{{}}'::jsonb END)
             WHERE key NOT LIKE 'published_%%_count'))$expr$;
        ELSIF name='cms.communities' THEN
          expression := $expr$to_jsonb(t) - 'meta' - 'articles_count' || jsonb_build_object('meta',
            (SELECT coalesce(jsonb_object_agg(key,value),'{{}}'::jsonb)
             FROM jsonb_each(CASE WHEN jsonb_typeof(to_jsonb(t)->'meta')='object' THEN to_jsonb(t)->'meta' ELSE '{{}}'::jsonb END)
             WHERE key NOT IN ('posts_count','blogs_count','changelogs_count','docs_count','tickets_count')))$expr$;
        END IF;
        EXECUTE format('SELECT count(*),md5(coalesce(string_agg(value, chr(10) ORDER BY value),'''')) FROM (SELECT (%s)::text value FROM %I.%I t WHERE %s) x',
          expression,row.schemaname,row.tablename,predicate) INTO total,digest;
        INSERT INTO r8_protected VALUES (phase,name,total,digest);
      END LOOP;
    """
    guards = f"""
      IF current_database() <> {literal(plan['database'])} THEN RAISE EXCEPTION 'Database mismatch'; END IF;
      IF EXISTS (SELECT 1 FROM public.oban_jobs WHERE state IN ('available','scheduled','executing','retryable')) THEN
        RAISE EXCEPTION 'Active jobs remain; stop producers and drain before reset'; END IF;
      IF EXISTS (SELECT 1 FROM messaging.notifications WHERE article_id IS NULL AND comment_id IS NULL) THEN
        RAISE EXCEPTION 'Non-content notifications require a row-level reset plan'; END IF;
      IF EXISTS (SELECT 1 FROM cms.artiment_reviews WHERE article_id IS NULL AND comment_id IS NULL) THEN
        RAISE EXCEPTION 'Non-content reviews require a row-level reset plan'; END IF;
    """
    inventory = " UNION ALL ".join(f'SELECT {literal(table)} AS name,count(*) AS count FROM {table_name(table)}' for table in tables)
    preamble = f"""BEGIN;
      SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s';
      {'SET TRANSACTION READ ONLY;' if not args.apply else ''}
      SELECT jsonb_build_object('database',current_database(),'tables',(SELECT jsonb_agg(x) FROM ({inventory})x));
    """
    if not args.apply:
        output = query(preamble + 'ROLLBACK;')
    else:
        output = query(preamble + f"""
          LOCK TABLE {tables_sql},cms.outbox_events,cms.command_receipts,public.oban_jobs IN ACCESS EXCLUSIVE MODE;
          CREATE TEMP TABLE r8_protected(phase integer,name text,total bigint,digest text) ON COMMIT DROP;
          DO $reset$ DECLARE row record; name text; predicate text; expression text;
            total bigint; digest text; phase integer := 0;
          BEGIN
            {guards}
            {fingerprint}
            TRUNCATE TABLE {tables_sql};
            DELETE FROM cms.outbox_events WHERE event IN ({outbox});
            DELETE FROM cms.command_receipts WHERE command IN ({receipts});
            DELETE FROM public.oban_jobs WHERE worker IN ({workers});
            UPDATE account.users u SET meta=(SELECT jsonb_object_agg(key,
              CASE WHEN key LIKE 'published_%_count' THEN '0'::jsonb ELSE value END)
              FROM jsonb_each(u.meta)) WHERE jsonb_typeof(u.meta)='object';
            UPDATE cms.communities c SET articles_count=0,meta=(SELECT jsonb_object_agg(key,
              CASE WHEN key IN ('posts_count','blogs_count','changelogs_count','docs_count','tickets_count')
                THEN '0'::jsonb ELSE value END) FROM jsonb_each(c.meta)) WHERE jsonb_typeof(c.meta)='object';
            phase := 1;
            {fingerprint}
            IF EXISTS (SELECT 1 FROM r8_protected a FULL JOIN r8_protected b
              ON a.name=b.name AND b.phase=1 WHERE a.phase=0 AND
              (b.name IS NULL OR a.total<>b.total OR a.digest<>b.digest)) THEN
              RAISE EXCEPTION 'Protected rows changed; reset rolled back';
            END IF;
          END $reset$;
          SELECT jsonb_build_object('protected_tables',count(*),'unchanged',true) FROM r8_protected WHERE phase=0;
          SELECT jsonb_build_object('remaining_articles',count(*)) FROM cms.articles;
          COMMIT;
        """)
    records = [json.loads(line) for line in output.splitlines() if line.startswith('{')]
    Path(args.output).write_text(json.dumps({'cutover_id': plan['cutover_id'],
        'host': uri.hostname, 'applied': args.apply, 'evidence': records}, indent=2) + '\n')
    print(json.dumps({'applied': args.apply, 'evidence_file': args.output}))


if __name__ == '__main__':
    run()
