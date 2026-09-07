#!/usr/bin/env bash

set -Eeuo pipefail

image_ref="${1:?Usage: deploy.sh <image@sha256:digest> <source-sha>}"
source_sha="${2:?Usage: deploy.sh <image@sha256:digest> <source-sha>}"

if [[ ! "$image_ref" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]; then
	printf 'The image reference must be a lowercase GHCR digest.\n' >&2
	exit 2
fi

if [[ ! "$source_sha" =~ ^[a-f0-9]{40}$ ]]; then
	printf 'The source revision must be a full git SHA.\n' >&2
	exit 2
fi

deploy_dir=/opt/vikunja
backup_dir="$deploy_dir/backups"
compose=(docker compose --env-file .env --env-file .deploy.env -f docker-compose.yml -f docker-compose.production.override.yml)
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

cd "$deploy_dir"
umask 077
mkdir -p "$backup_dir"

if [[ -f .deploy.env ]]; then
	cp .deploy.env "$backup_dir/deploy-${timestamp}.env"
fi
previous_image_ref="$(docker inspect --format '{{.Config.Image}}' vikunja)"
printf '%s\n' "$previous_image_ref" >"$backup_dir/vikunja-image-${timestamp}.txt"
docker exec vikunja-db pg_dump -U vikunja vikunja | gzip >"$backup_dir/vikunja-postgres-${timestamp}.sql.gz"
gzip -t "$backup_dir/vikunja-postgres-${timestamp}.sql.gz"

deploy_env="$(mktemp .deploy.env.XXXXXX)"
printf 'VIKUNJA_IMAGE=%s\nVIKUNJA_DEPLOYED_SHA=%s\n' "$image_ref" "$source_sha" >"$deploy_env"
mv "$deploy_env" .deploy.env

"${compose[@]}" config -q
"${compose[@]}" pull vikunja
"${compose[@]}" up -d --no-deps vikunja

for attempt in {1..30}; do
	if [[ "$(docker inspect --format '{{.State.Running}}' vikunja)" == true ]]; then
		domain="$(sed -n 's/^VIKUNJA_DOMAIN=//p' .env | tail -n 1 | tr -d '\r\"')"
		if [[ -n "$domain" ]] && curl --fail --silent --show-error --resolve "$domain:443:127.0.0.1" "https://$domain/api/v1/info" >/dev/null; then
			printf 'Deployment succeeded: %s (%s)\n' "$source_sha" "$image_ref"
			exit 0
		fi
	fi
	sleep 2
done

docker logs --tail 100 vikunja >&2
printf 'VIKUNJA_IMAGE=%s\nVIKUNJA_DEPLOYED_SHA=rollback-from-%s\n' "$previous_image_ref" "$source_sha" > .deploy.env
"${compose[@]}" config -q
"${compose[@]}" up -d --no-deps vikunja
printf 'Vikunja did not become healthy; rolled back to %s. Database migrations cannot be rolled back automatically.\n' "$previous_image_ref" >&2
exit 1
