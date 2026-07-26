#!/usr/bin/env bash
# Run this ON THE EC2 BOX to deploy the latest images from GHCR.
#   ./deploy.sh
# It pulls the newest images, restarts the containers, and cleans up old images.
set -euo pipefail

COMPOSE_FILE="docker-compose.deploy.yml"

echo "==> Pulling latest images from GHCR..."
docker compose -f "$COMPOSE_FILE" pull

echo "==> Starting/restarting containers..."
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Cleaning up old, unused images..."
docker image prune -f

echo "==> Done. Current status:"
docker compose -f "$COMPOSE_FILE" ps
