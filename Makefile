COMPOSE := docker compose --project-directory . -f .docker/docker-compose.yml

.PHONY: up server client build down clean logs ps seed migration test-int stop push

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

test-int:
	$(COMPOSE) exec backend npm run test:int

migration:
	@test -n "$(name)" || { echo 'Usage: make migration name=nom_de_la_migration'; exit 1; }
	$(COMPOSE) exec backend npx prisma migrate dev --name $(name)

stop:
	@ids="$$(docker ps -q)"; \
	if [ -n "$$ids" ]; then \
		echo "Arrêt de $$(echo "$$ids" | wc -l | tr -d ' ') conteneur(s) actif(s)..."; \
		docker stop $$ids; \
	else \
		echo "Aucun conteneur actif."; \
	fi
