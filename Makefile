COMPOSE := docker compose -f .docker/compose.dev.yml

.PHONY: up server client build down clean logs ps

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
