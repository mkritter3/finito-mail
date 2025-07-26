# Docker Development Setup

This document describes how to set up and run Finito Mail using Docker for development.

## Prerequisites

- Docker and Docker Compose installed
- Copy `.env.example` to `.env` and configure your environment variables

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the automated setup script
./scripts/docker-dev.sh
```

This script will:
1. Check for `.env` file and create it from `.env.example` if needed
2. Start the PostgreSQL database
3. Run database migrations
4. Start the API and web services

### Option 2: Manual Setup

```bash
# 1. Start database
docker-compose up -d db

# 2. Run migrations
docker-compose run --rm migrate

# 3. Start all services
docker-compose up api web
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `db` | 5432 | PostgreSQL database |
| `api` | 3001 | Next.js API server |
| `web` | 3000 | Next.js web application |
| `migrate` | - | Database migration runner |

## Development Workflow

### Running Migrations

```bash
# Run database migrations
docker-compose run --rm migrate

# Or with the migration profile
docker-compose --profile migration up migrate
```

### Accessing Services

- **Web Application**: http://localhost:3000
- **API Server**: http://localhost:3001
- **Database**: postgresql://postgres:password@localhost:5432/finito_mail

### Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f db
```

### Development Commands

```bash
# Start only the database (useful for running API/web locally)
docker-compose up -d db

# Rebuild services after code changes
docker-compose up --build

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ destroys database data)
docker-compose down -v
```

## Environment Variables

The following environment variables are required in your `.env` file:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/finito_mail"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Application URLs
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WEB_URL="http://localhost:3000"

# JWT Secret
NEXTAUTH_SECRET="your-jwt-secret"
```

## Database Management

### Connecting to Database

```bash
# Connect to PostgreSQL database
docker-compose exec db psql -U postgres -d finito_mail

# Or using external client
psql postgresql://postgres:password@localhost:5432/finito_mail
```

### Backup and Restore

```bash
# Backup database
docker-compose exec db pg_dump -U postgres finito_mail > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres finito_mail < backup.sql
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, and 5432 are not in use
2. **Database connection errors**: Wait for the database health check to pass
3. **Migration failures**: Check that the database is running and accessible

### Reset Everything

```bash
# Stop all services and remove volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
./scripts/docker-dev.sh
```

### Debugging

```bash
# Execute bash in running container
docker-compose exec api sh
docker-compose exec web sh

# Run a one-off command
docker-compose run --rm api npm run lint
```

## Production Considerations

This Docker setup is optimized for development. For production deployment:

1. Use multi-stage builds to reduce image size
2. Configure proper secrets management
3. Set up proper logging and monitoring
4. Use a managed database service
5. Configure proper SSL/TLS certificates