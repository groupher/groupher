# naming should be [part].[action].[env].[sub-app]
# frontend
fe.install:
	pnpm install --frozen-lockfile

# landing
fe.dev.landing:
	pnpm devhub start landing

fe.dev.landing.managed:
	pnpm run dev:landing:managed

fe.build.landing:
	pnpm run build:prod:landing

fe.serve.landing: 
	pnpm run serve:prod:landing

# inspire-me
fe.dev.inspire:
	pnpm devhub start inspire-me

fe.dev.inspire.managed:
	pnpm run dev:inspire-me:managed

fe.inspire-me.deploy:
	@pnpm --filter @groupher/inspire-me exec cf auth whoami >/dev/null 2>&1 || pnpm --filter @groupher/inspire-me exec cf auth login
	pnpm --filter @groupher/inspire-me run deploy

inspire: fe.dev.inspire

# local development hub
dev:
	pnpm devhub up

dev.hub:
	pnpm devhub foreground

dev.dev:
	pnpm --filter @groupher/local-dev-hub run dev

dev.app:
	@bash local/dev-hub/scripts/install-app.sh

fe.dev.dash:
	pnpm devhub start dash

fe.dev.dash.managed:
	pnpm run dev:dash:managed

fe.dev.apply:
	pnpm devhub start apply

fe.dev.apply.managed:
	pnpm run dev:apply:managed

fe.dev.community:
	pnpm devhub start community

fe.dev.community.managed:
	pnpm run dev:community:managed

fe.dev.widget:
	pnpm devhub start widget-sandbox

fe.dev.widget.managed:
	pnpm run dev:widget:managed

fe.dev.vgpu-poc:
	pnpm devhub start core-vgpu-poc

fe.dev.vgpu-poc.managed:
	pnpm --filter @groupher/frontend-core run poc:vgpu:dev:managed

fe.build.dash:
	pnpm run build:prod:dash

fe.build.apply:
	pnpm run build:prod:apply

fe.test.landing:
	pnpm run test:landing

fe.e2e.landing:
	pnpm run test:e2e:landing

# dev gateway
be.dev-gateway.start:
	pnpm devhub start dev-gateway

be.dev-gateway.start.managed:
	pnpm run dev:dev-gateway:managed

be.dev-gateway.build:
	pnpm run build:prod:dev-gateway

be.dev-gateway.test:
	pnpm --filter @groupher/dev-gateway run test

# auth
be.auth.start:
	pnpm devhub start auth

be.auth.start.managed:
	pnpm run dev:auth:managed

be.auth.build:
	pnpm run build:prod:auth

be.auth.test:
	pnpm --filter @groupher/backend-auth run test

# content import
be.import.start:
	pnpm devhub start import

be.import.start.managed:
	pnpm run dev:import:managed

be.import.build:
	pnpm --filter @groupher/import run deploy:dry-run

be.import.test:
	pnpm --filter @groupher/import run test

be.press.start:
	pnpm --filter @groupher/press run db:migrate
	pnpm devhub start press

be.press.start.managed:
	pnpm run dev:press:managed

be.press.migrate:
	pnpm --filter @groupher/press run db:migrate

be.press.build:
	pnpm run build:prod:press

be.press.test:
	pnpm --filter @groupher/press run test

# assets hub
fe.assets-hub.deploy:
	pnpm --filter @groupher/assets-hub run deploy:worker

# document converter
be.converter.start:
	pnpm devhub start converter

be.converter.start.managed:
	pnpm run dev:converter:managed

be.converter.test:
	pnpm run test:converter

# backend
# mix ecto.setup
be.install:
	cd ./backend/api && mix deps.get

be.start:
	pnpm devhub start phoenix

# Dev Hub owns the full managed runtime environment. Credential fallbacks are
# allow-listed by Dev Hub before this entrypoint is invoked.
be.start.managed:
	cd ./backend/api && MIX_ENV=dev mix phx.server

# mock server
be.mock-server.start:
	pnpm devhub start mock-server

be.mock-server.start.managed:
	pnpm run mock:server:managed

# assets hub
be.assets-hub.start:
	pnpm devhub start assets-hub

be.assets-hub.start.managed:
	pnpm run dev:assets-hub:managed

be.assets-read-worker.start:
	pnpm devhub start assets-read-worker

be.assets-read-worker.start.managed:
	pnpm --filter @groupher/assets-hub run dev:read-worker:managed

be.edge-router.start:
	pnpm devhub start edge-router

be.edge-router.start.managed:
	pnpm --filter @groupher/edge-router run dev:managed

be.status.start:
	pnpm devhub start status

be.status.start.managed:
	pnpm --filter @groupher/status run dev:managed

be.status.db.migrate.local:
	pnpm --filter @groupher/status run db:migrate:local

be.review-ai-worker.start:
	pnpm devhub start review-ai-worker

be.review-ai-worker.start.managed:
	pnpm --filter @groupher/review-ai-worker run dev:managed

# generate graphql schema (SDL) and link it for the local frontend server
be.gen.schema:
	cd ./backend/api && mix absinthe.schema.sdl schema.graphql && cd - \
	&& rm -f ./frontend/mock-server/schema.graphql \
	&& ln -s ../../backend/api/schema.graphql ./frontend/mock-server/schema.graphql

sync.schema: be.gen.schema

# work around, see: https://elixirforum.com/t/mix-test-file-watch/12298/2
# mix test --listen-on-stdin --stale --trace --only wip

# test.watch not work now, see: https://github.com/lpil/mix-test.watch/issues/116
# mix test.watch --only wip --stale
be.test:
	cd ./backend/api && mix test

be.watch.wip:
	cd ./backend/api && mix test --listen-on-stdin --stale --only wip
	
be.watch.wip2:
	cd ./backend/api && mix test --listen-on-stdin --stale --only wip2

be.migrate:
	cd ./backend/api && MIX_ENV=dev mix ecto.migrate && cd -

be.seed.home:
	pnpm seed home prepare

be.migrate.prod:
	cd ./backend/api && MIX_ENV=prod mix ecto.migrate && cd -

be.migrate.test:
	cd ./backend/api && MIX_ENV=test mix ecto.migrate && cd -

be.rollback:
	cd ./backend/api && MIX_ENV=dev mix ecto.rollback && cd -
be.rollback.test:
	cd ./backend/api && MIX_ENV=test mix ecto.rollback && cd -

be.deploy:
	cd ./backend/api && flyctl deploy && cd -

be.status.deploy:
	$(MAKE) status.deploy

be.status.config.validate:
	$(MAKE) status.validate

status.validate:
	pnpm --filter @groupher/status run type-check
	pnpm --filter @groupher/status run test
	pnpm --filter @groupher/status run deploy:dry-run

status.deploy: status.validate
	pnpm --filter @groupher/status exec wrangler d1 migrations apply groupher-status --remote
	pnpm --filter @groupher/status run deploy

be.status:
	flyctl status -a groupher-api

be.log:
	flyctl logs -a groupher-api

be.check:
	flyctl checks list -a groupher-api

serve.help:
	$(call serve.help)
	@echo "\n"
serve:
	$(call serve.help)
	@echo "\n"

deploy:
	$(call deploy.help)
	@echo "\n"
deploy.help:
	$(call deploy.help)
	@echo "\n"
