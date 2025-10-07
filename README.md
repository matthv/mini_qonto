# Mini Qonto — Local Setup

This guide walks through bootstrapping the project with Docker, preparing the
databases, and seeding local data.

## Prerequisites

- Docker Desktop (or Docker Engine) and Docker Compose
- A copy of this repository on your machine

## 1. Configure environment variables

Copy the provided template and adjust values as needed:

```bash
cp .env.example .env
```

The defaults work for local development. Update any secrets that differ in your
environment.

## 2. Start the database container

Bring up PostgreSQL on port `5432`:

```bash
docker compose up -d db
```

The container exposes the database on `localhost:5432`, which is what the setup
script expects.

## 3. Provision the databases

Run the helper script from the `web` image so all required databases are
created:

```bash
docker compose run --rm web bin/create_databases
```

This uses the credentials from `.env` and is idempotent, so you can re-run it at
any time.

## 4. Launch the web server

Start the Rails app (the command also runs `db:create`/`db:migrate` on boot):

```bash
docker compose up web
```

Once the container finishes booting, the application is available at
`http://localhost:3002`.

## 5. Seed local data

In a separate terminal, load the seed data into the running container:

```bash
docker compose exec web bundle exec rails db:seed
```

You now have a fully configured local environment backed by Docker. Stop the
services with `CTRL+C` (or `docker compose down` when you are done).
