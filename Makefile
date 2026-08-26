# naming should be [part].[action].[env].[sub-app]
# frontend
fe.install:
	yarn install

# landing
fe.dev.landing:
	PORT=3002 NEXT_PUBLIC_SITE_URL=http://localhost:3002 yarn run dev:landing

fe.build.landing:
	yarn run build:prod:landing

fe.serve.landing: 
	yarn run serve:prod:landing

# inspire-me
fe.dev.inspire:
	(sleep 2 && open http://localhost:3010/canny) &
	yarn workspace @groupher/inspire-me dev --port 3010

fe.inspire-me.deploy:
	@yarn workspace @groupher/inspire-me exec wrangler whoami >/dev/null 2>&1 || yarn workspace @groupher/inspire-me exec wrangler login
	yarn workspace @groupher/inspire-me deploy

inspire: fe.dev.inspire

# local development hub
dev:
	yarn workspace @groupher/local-dev-hub hub

dev.dev:
	yarn workspace @groupher/local-dev-hub dev

dev.app:
	@bash local/dev-hub/scripts/install-app.sh

fe.dev.dash:
	PORT=3005 GRAPHQL_ENDPOINT=http://127.0.0.1:4001/graphiql NEXT_PUBLIC_SITE_URL=https://dash.groupher.localhost NEXT_PUBLIC_AUTH_ENDPOINT=https://auth.groupher.localhost/api/auth yarn run dev:dash

fe.dev.apply:
	PORT=3006 GRAPHQL_ENDPOINT=http://127.0.0.1:4001/graphiql NEXT_PUBLIC_SITE_URL=https://groupher.localhost yarn run dev:apply

fe.build.dash:
	yarn run build:prod:dash

fe.build.apply:
	yarn run build:prod:apply

fe.test.landing:
	yarn run test:landing

fe.e2e.landing:
	yarn run test:e2e:landing

# dev gateway
be.dev-gateway.start:
	yarn run dev:dev-gateway

be.dev-gateway.build:
	yarn run build:prod:dev-gateway

be.dev-gateway.test:
	yarn workspace @groupher/dev-gateway test

# auth
be.auth.start:
	PORT=3004 AUTH_URL=https://auth.groupher.localhost yarn run dev:auth

be.auth.build:
	yarn run build:prod:auth

be.auth.test:
	yarn workspace @groupher/backend-auth test

# content import
be.content-import.start:
	yarn run dev:content-import

be.content-import.build:
	yarn run build:prod:content-import

be.content-import.test:
	yarn workspace @groupher/backend-content-import test

be.press.start:
	yarn workspace @groupher/press db:migrate && yarn run dev:press

be.press.build:
	yarn run build:prod:press

be.press.test:
	yarn workspace @groupher/press test

# assets hub
fe.assets-hub.deploy:
	yarn workspace @groupher/assets-hub deploy:worker

# document converter
be.document-converter.install:
	yarn run document-converter:install

be.document-converter.start:
	yarn run dev:document-converter

be.document-converter.test:
	yarn run test:document-converter

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
