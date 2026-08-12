.PHONY: help up down test lint dev-api dev-web seed clean

help:
	@echo "make up       — start everything (mock backend, no API keys needed)"
	@echo "make test     — run the backend test suite"
	@echo "make lint     — ruff + mypy + tsc"
	@echo "make dev-api  — run the API alone on :8000"
	@echo "make dev-web  — run the UI alone on :5173"
	@echo "make down     — stop everything"

up:
	docker compose up --build

down:
	docker compose down

test:
	cd backend && python -m pytest -q

lint:
	cd backend && ruff check app tests && mypy app
	cd frontend && npx tsc --noEmit

dev-api:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-web:
	cd frontend && npm run dev

seed:
	docker compose exec db psql -U factory -d factory -f /docker-entrypoint-initdb.d/002_seed.sql

clean:
	docker compose down -v
	rm -rf frontend/node_modules frontend/dist backend/.pytest_cache
