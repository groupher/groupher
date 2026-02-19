OS := ${shell uname}

ifeq ($(OS),Darwin)  # Mac OS X
		JSON_CLI=./tools/jq-mac
endif
ifeq ($(OS),Linux)
		JSON_CLI=//usr/local/bin/jq
endif

before_action:
	@chmod 755 $(JSON_CLI)

# naming should be [part].[action].[env].[sub-app]
# frontend
fe.install:
	yarn install

# landing
fe.dev.landing:
	yarn run dev:landing

fe.build.landing:
	yarn run build:prod:landing

fe.serve.landing: 
	yarn run serve:prod:landing

# main
fe.dev.main:
	yarn run dev:main

fe.build.main:
	yarn run build:prod:main

fe.serve.main: 
	yarn run serve:prod:main

# dashboard
fe.dev.dashboard:
	yarn run dev:dashboard

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

# backend
# mix ecto.setup
be.install:
	cd ./backend/main && mix deps.get 

be.start:
	cd ./backend/main && MIX_ENV=mock mix phx.server

# generate graphql schema (SDL) and copy to front ends
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
	cd ./backend/main && fly deploy && cd -

# dev: before_action
# 	@$(JSON_CLI) -s '.[0] * .[1]' config/config.json config/config.dev.json > /tmp/config.json
# 	@cp /tmp/config.json ./config/config.json
# 	npm run update.version
# 	npm run dev

# build.dev: before_action
# 	@$(JSON_CLI) -s '.[0] * .[1]' config/config.json config/config.dev.json > /tmp/config.json
# 	@cp /tmp/config.json ./config/config.json
# 	npm run build.dev

# build.prod: before_action
# 	@$(JSON_CLI) -s '.[0] * .[1]' config/config.json config/config.prod.json > /tmp/config.json
# 	@cp /tmp/config.json ./config/config.json
# 	npm run build.prod --debug

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
