# Docker Guide for Mini Qonto

## Prerequisites
- Docker
- Docker Compose

## Configuration

### Option 1: Use Local Gems (Recommended for Development)

The `docker-compose.yml` is configured to mount local Forest Admin gems as volumes. The paths are already configured.

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f web

# Access the container
docker-compose exec web bash

# Stop services
docker-compose down
```

### Option 2: Modify Gemfile for Docker

If you want to build a standalone image without local dependencies:

1. Rename your current Gemfile:
```bash
mv Gemfile Gemfile.local
```

2. Use the Docker Gemfile:
```bash
cp Gemfile.docker Gemfile
```

3. Modify the Dockerfile to copy local gems:
```dockerfile
COPY --from=gems /path/to/gems /forest_admin_gems
```

## Useful Commands

### Database
```bash
# Create all PostgreSQL databases using the helper script
bin/create_databases

# Create databases
docker-compose exec web rails db:create

# Run migrations for all databases
docker-compose exec web rails db:migrate

# Run migrations for a specific database
docker-compose exec web rails db:migrate:api
docker-compose exec web rails db:migrate:card_claim
docker-compose exec web rails db:migrate:company_monitoring
docker-compose exec web rails db:migrate:biller

# Rails console
docker-compose exec web rails console

# Reset databases
docker-compose exec web rails db:drop db:create db:migrate
```

> Tip: When the app runs inside Docker, execute `docker-compose exec web bin/create_databases` to run the script in the container environment.

### Rebuild
```bash
# Rebuild the image if you modify the Dockerfile
docker-compose build

# Rebuild and restart
docker-compose up --build
```

### Cleanup
```bash
# Remove containers, volumes and images
docker-compose down -v --rmi all
```

## Application Access

The application will be accessible at: http://localhost:3000

PostgreSQL will be accessible at: localhost:5432

## Environment Variables

Environment variables are defined in `docker-compose.yml`. For secrets like `FOREST_ENV_SECRET` and `FOREST_AUTH_SECRET`, you can:

1. Create a `.env.docker` file:
```bash
FOREST_ENV_SECRET=your_secret
FOREST_AUTH_SECRET=your_secret
```

2. Modify `docker-compose.yml` to use it:
```yaml
env_file:
  - .env.docker
```

## Known Issues

### Local Gems
Forest Admin gems are mounted from your local system. Make sure the paths in `docker-compose.yml` match your installation.

### Permissions
If you encounter permission issues, you can add a user in the Dockerfile:
```dockerfile
RUN useradd -m -u 1000 rails
USER rails
```
