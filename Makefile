COMPOSE := docker compose -f .docker/compose.dev.yml

.PHONY: up server client build down clean logs ps push

ifeq (push,$(firstword $(MAKECMDGOALS)))
MSG := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
%:
	@:
endif

push:
	@test -n "$(MSG)" || { echo 'Usage: make push "message de commit"'; exit 1; }
	git add .
	git commit -m "$(MSG)"
	git push

up:
	$(COMPOSE) up -d --build

server:
	$(COMPOSE) up -d --build server

client:
	$(COMPOSE) up -d --build client

build:
	$(COMPOSE) build

down:
	$(COMPOSE) down

clean:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps
