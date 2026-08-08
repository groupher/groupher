CREATE SCHEMA IF NOT EXISTS "analysis";

CREATE TABLE IF NOT EXISTS "analysis"."press_metric_events" (
  "id" bigserial PRIMARY KEY,
  "request_time_utc" timestamptz NOT NULL,
  "community_ref" text NOT NULL,
  "thread" text,
  "content_ref" text,
  "output_kind" text NOT NULL,
  "status_code" integer NOT NULL,
  "cache_status" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "origin_duration_ms" integer NOT NULL DEFAULT 0,
  "render_duration_ms" integer NOT NULL DEFAULT 0,
  "response_bytes" bigint NOT NULL,
  "bot_family" text NOT NULL,
  "ua_family" text,
  "client_ip_hash" text,
  "request_id" text NOT NULL,
  "revision" text
);
CREATE INDEX IF NOT EXISTS "press_metric_events_request_time_idx" ON "analysis"."press_metric_events" ("request_time_utc");
CREATE INDEX IF NOT EXISTS "press_metric_events_community_content_idx" ON "analysis"."press_metric_events" ("community_ref", "content_ref", "request_time_utc");

CREATE TABLE IF NOT EXISTS "analysis"."press_metric_hourly" (
  "hour_bucket" timestamptz NOT NULL,
  "community_ref" text NOT NULL,
  "thread" text NOT NULL DEFAULT '',
  "content_ref" text NOT NULL DEFAULT '',
  "output_kind" text NOT NULL,
  "status_code" integer NOT NULL,
  "cache_status" text NOT NULL,
  "bot_family" text NOT NULL,
  "requests_total" bigint NOT NULL DEFAULT 0,
  "response_bytes_total" bigint NOT NULL DEFAULT 0,
  "duration_ms_total" bigint NOT NULL DEFAULT 0,
  CONSTRAINT "press_metric_hourly_pk" PRIMARY KEY ("hour_bucket", "community_ref", "thread", "content_ref", "output_kind", "status_code", "cache_status", "bot_family")
);

CREATE TABLE IF NOT EXISTS "analysis"."press_output_cache" (
  "key" text PRIMARY KEY,
  "status" integer NOT NULL,
  "body" text NOT NULL,
  "headers" jsonb NOT NULL,
  "metadata" jsonb,
  "expires_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "press_output_cache_expires_idx" ON "analysis"."press_output_cache" ("expires_at");
