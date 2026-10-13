COMPOSE := docker compose --project-directory . -f .docker/docker-compose.yml

.PHONY: up server client build down clean logs ps seed migration stop push

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
	$(COMPOSE) up -d --build -V

server:
	$(COMPOSE) up -d --build -V backend

client:
	$(COMPOSE) up -d --build -V frontend

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

seed:
	$(COMPOSE) exec backend npx prisma db seed

migration:
	@test -n "$(name)" || { echo 'Usage: make migration name=nom_de_la_migration'; exit 1; }
	$(COMPOSE) exec backend npx prisma migrate dev --name $(name)

stop: 
		@echo "=== Arret de tous les containers actifs... ==="
		@if [ -n "$$(docker ps -q)" ]; then \
			docker stop $$(docker ps -q); \
			docker compose down -v; \
		else \
			echo "Aucun container actif."; \
		fi
