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
	yarn workspace @groupher/local-inspire-me dev -p 3010

inspire: fe.dev.inspire

# local development hub
dev:
	yarn workspace @groupher/local-dev-hub hub

dev.dev:
	yarn workspace @groupher/local-dev-hub dev

dev.app:
	@bash local/dev-hub/scripts/install-app.sh

# main
fe.dev.main:
	PORT=3000 NEXT_PUBLIC_SITE_URL=https://groupher.localhost yarn run dev:main

fe.build.main:
	yarn run build:prod:main

fe.serve.main: 
	yarn run serve:prod:main

# dashboard
fe.dev.dashboard:
	PORT=3001 NEXT_PUBLIC_SITE_URL=https://groupher.localhost yarn run dev:dashboard

fe.build.dashboard:
	yarn run build:prod:dashboard

fe.serve.dashboard: 
	yarn run serve:prod:dashboard

fe.test.dashboard:
	yarn run test:dashboard

fe.test.main:
	yarn run test:main

fe.test.landing:
	yarn run test:landing

fe.e2e.dashboard:
	yarn run test:e2e:dashboard

fe.e2e.main:
	yarn run test:e2e:main

fe.e2e.landing:
	yarn run test:e2e:landing

fe.dev.dsb: fe.dev.dashboard
fe.build.dsb: fe.build.dashboard
fe.serve.dsb: fe.serve.dashboard
fe.test.dsb: fe.test.dashboard
fe.e2e.dsb: fe.e2e.dashboard

# gateway
be.gateway.start:
	yarn run dev:gateway

be.gateway.build:
	yarn run build:prod:gateway

be.gateway.test:
	yarn workspace @groupher/backend-gateway test

# auth
be.auth.start:
	PORT=3004 AUTH_URL=https://groupher.localhost yarn run dev:auth

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
	cd ./backend/main && mix deps.get 

be.start:
	cd ./backend/main && MIX_ENV=mock mix phx.server

# generate graphql schema (SDL) and link it for the mock server
be.gen.schema:
	cd ./backend/main && mix absinthe.schema.sdl schema.graphql && cd - \
	&& rm -f ./frontend/mock-server/schema.graphql \
	&& ln -s ../../backend/main/schema.graphql ./frontend/mock-server/schema.graphql

sync.schema: be.gen.schema

# work around, see: https://elixirforum.com/t/mix-test-file-watch/12298/2
# mix test --listen-on-stdin --stale --trace --only wip

# test.watch not work now, see: https://github.com/lpil/mix-test.watch/issues/116
# mix test.watch --only wip --stale
be.test:
	cd ./backend/main && mix test

be.watch.wip:
	cd ./backend/main && mix test --listen-on-stdin --stale --only wip
	
be.watch.wip2:
	cd ./backend/main && mix test --listen-on-stdin --stale --only wip2

be.mock.start: 
	cd ./backend/main && MIX_ENV=mock mix phx.server

be.migrate:
	cd ./backend/main && mix ecto.migrate && cd -

be.migrate.prod:
	cd ./backend/main && MIX_ENV=prod mix ecto.migrate && cd -

be.migrate.mock:
	cd ./backend/main && MIX_ENV=mock mix ecto.migrate && cd -

be.migrate.dev:
	cd ./backend/main && MIX_ENV=dev mix ecto.migrate && cd -

be.migrate.test:
	cd ./backend/main && MIX_ENV=test mix ecto.migrate && cd -

be.rollback:
	cd ./backend/main && mix ecto.rollback && cd -

be.rollback.mock:
	cd ./backend/main && MIX_ENV=mock mix ecto.rollback && cd -
be.rollback.test:
	cd ./backend/main && MIX_ENV=test mix ecto.rollback && cd -

be.rollback.dev:
	cd ./backend/main && MIX_ENV=dev mix ecto.rollback && cd -


be.deploy:
	cd ./backend/main && flyctl deploy && cd -

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
