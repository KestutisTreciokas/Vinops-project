COMPOSE := docker compose -f docker-compose.prod.yml -f docker-compose.hostfix.yml $(if $(wildcard docker-compose.db.yml),-f docker-compose.db.yml,)
export GIT_SHA ?= $(shell git rev-parse --short HEAD)
export APP_VERSION ?= prod-$(shell date -u +%Y%m%d-%H%M%S)

up:
	$(COMPOSE) up -d --build

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --no-log-prefix web

down:
	$(COMPOSE) down
