# naming should be [part].[action].[env].[sub-app]
# frontend
fe.install:
	pnpm install --frozen-lockfile

# landing
fe.dev.landing:
	PORT=3002 NEXT_PUBLIC_SITE_URL=http://localhost:3002 pnpm run dev:landing

fe.build.landing:
	pnpm run build:prod:landing

fe.serve.landing: 
	pnpm run serve:prod:landing

# inspire-me
fe.dev.inspire:
	(sleep 2 && open http://localhost:3010/canny) &
	pnpm --filter @groupher/inspire-me run dev --port 3010

fe.inspire-me.deploy:
	@pnpm --filter @groupher/inspire-me exec wrangler whoami >/dev/null 2>&1 || pnpm --filter @groupher/inspire-me exec wrangler login
	pnpm --filter @groupher/inspire-me run deploy

inspire: fe.dev.inspire

# local development hub
dev:
	pnpm --filter @groupher/local-dev-hub run hub

dev.dev:
	pnpm --filter @groupher/local-dev-hub run dev

dev.app:
	@bash local/dev-hub/scripts/install-app.sh

fe.dev.dash:
	PORT=3005 GRAPHQL_ENDPOINT=http://127.0.0.1:4001/graphiql NEXT_PUBLIC_SITE_URL=https://dash.groupher.localhost NEXT_PUBLIC_AUTH_ENDPOINT=https://auth.groupher.localhost/api/auth pnpm run dev:dash

fe.dev.apply:
	PORT=3006 GRAPHQL_ENDPOINT=http://127.0.0.1:4001/graphiql NEXT_PUBLIC_SITE_URL=https://groupher.localhost pnpm run dev:apply

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
	pnpm run dev:dev-gateway

be.dev-gateway.build:
	pnpm run build:prod:dev-gateway

be.dev-gateway.test:
	pnpm --filter @groupher/dev-gateway run test

# auth
be.auth.start:
	PORT=3004 AUTH_URL=https://auth.groupher.localhost pnpm run dev:auth

be.auth.build:
	pnpm run build:prod:auth

be.auth.test:
	pnpm --filter @groupher/backend-auth run test

# content import
be.content-import.start:
	pnpm run dev:content-import

be.content-import.build:
	pnpm run build:prod:content-import

be.content-import.test:
	pnpm --filter @groupher/backend-content-import run test

be.press.start:
	pnpm --filter @groupher/press run db:migrate && pnpm run dev:press

be.press.build:
	pnpm run build:prod:press

be.press.test:
	pnpm --filter @groupher/press run test

# assets hub
fe.assets-hub.deploy:
	pnpm --filter @groupher/assets-hub run deploy:worker

# document converter
be.document-converter.install:
	pnpm run document-converter:install

be.document-converter.start:
	pnpm run dev:document-converter

be.document-converter.test:
	pnpm run test:document-converter

# backend
# mix ecto.setup
be.install:
	cd ./backend/api && mix deps.get

be.start:
	cd ./backend/api && if [ -f .env.local ]; then set -a; . .env.local; set +a; fi; MIX_ENV=mock mix phx.server

# generate graphql schema (SDL) and link it for the mock server
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

be.mock.start: 
	cd ./backend/api && if [ -f .env.local ]; then set -a; . .env.local; set +a; fi; MIX_ENV=mock mix phx.server

be.migrate:
	cd ./backend/api && mix ecto.migrate && cd -

be.migrate.prod:
	cd ./backend/api && MIX_ENV=prod mix ecto.migrate && cd -

be.migrate.mock:
	cd ./backend/api && MIX_ENV=mock mix ecto.migrate && cd -

be.migrate.dev:
	cd ./backend/api && MIX_ENV=dev mix ecto.migrate && cd -

be.migrate.test:
	cd ./backend/api && MIX_ENV=test mix ecto.migrate && cd -

be.rollback:
	cd ./backend/api && mix ecto.rollback && cd -

be.rollback.mock:
	cd ./backend/api && MIX_ENV=mock mix ecto.rollback && cd -
be.rollback.test:
	cd ./backend/api && MIX_ENV=test mix ecto.rollback && cd -

be.rollback.dev:
	cd ./backend/api && MIX_ENV=dev mix ecto.rollback && cd -


be.deploy:
	cd ./backend/api && flyctl deploy && cd -

be.status.deploy:
	cd ./ops/status && flyctl deploy --config fly.toml --remote-only && cd -

be.status.config.validate:
	./ops/status/validate-config.sh

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
