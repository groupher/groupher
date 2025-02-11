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

fe.dev.landing:
	yarn run dev:landing

fe.dev.main:
	yarn run dev:main

fe.build.main:
	yarn run build:prod:main

fe.build.prod.main: 
	yarn run build:prod:main

fe.serve.main: 
	yarn run serve:prod:main

# backend
# mix ecto.setup
be.install:
	cd ./backend && mix deps.get 

be.start:
	cd ./backend && MIX_ENV=mock mix phx.server

be.mock.start: 
	cd ./backend && MIX_ENV=mock mix phx.server

be.migrate:
	cd ./backend && mix ecto.migrate && cd ..

be.migrate.prod:
	cd ./backend && MIX_ENV=prod mix ecto.migrate && cd ..

be.migrate.mock:
	cd ./backend && MIX_ENV=mock mix ecto.migrate && cd ..

be.migrate.dev:
	cd ./backend && MIX_ENV=dev mix ecto.migrate && cd ..

be.migrate.test:
	cd ./backend && MIX_ENV=test mix ecto.migrate && cd ..

be.rollback:
	cd ./backend && mix ecto.rollback && cd..

be.rollback.mock:
	cd ./backend && MIX_ENV=mock mix ecto.rollback && cd ..
be.rollback.test:
	cd ./backend && MIX_ENV=test mix ecto.rollback && cd ..

be.rollback.dev:
	cd ./backend && MIX_ENV=dev mix ecto.rollback && cd ..


be.deploy:
	cd ./backend && fly deploy && cd ..

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
