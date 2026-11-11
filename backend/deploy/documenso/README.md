# Documenso signing server — deploy

Deployed by the **`deploy_documenso`** (manual) job in the backend
`.gitlab-ci.yml`, following the Docker Compose self-hosting guide. Uses the
prebuilt `documenso/documenso:latest` image — nothing is built here.

**Exposure model.** The backend ↔ Documenso traffic stays internal on `localnet`
(by container name — never the internet). The *signing page* must be reachable by
signers' browsers (which are not on the Docker network), so Traefik publishes two
hostnames. They're public, but protected by: signup disabled, unguessable
per-recipient signing tokens, and the API requiring the Bearer token. To restrict
to specific networks, add a Traefik IP-allowlist middleware (one label) — this
needs the allowed CIDRs from whoever runs the host.

## What it runs

| Service          | Container          | Purpose                                  |
| ---------------- | ------------------ | ---------------------------------------- |
| `documenso`      | `documenso-app`    | App; Traefik → `${DOCUMENSO_HOST}` (signing page) |
| `database`       | `documenso-db`     | Dedicated Postgres 15 (isolated from gafood's `eofficedb`) |
| `minio`          | `documenso-minio`  | S3 storage; Traefik → `${DOCUMENSO_FILES_HOST}` + shared with backend |

> Email is disabled (no Mailpit/SMTP server): the signing link is surfaced via
> the gafood FE, and the backend sends with `sendEmail:false`.

`documenso-app` and `documenso-minio` also join the external **`localnet`**
network so the backend container reaches them by name:

- `DOCUMENSO_API_URL=http://documenso-app:3000`
- `S3_ENDPOINT=http://documenso-minio:9002`

(These are already the defaults in the backend pipeline.)

### Why MinIO is exposed via Traefik too

The signer's **browser** loads the PDF from MinIO via a presigned URL, so
`NEXT_PRIVATE_UPLOAD_ENDPOINT` points at the public `${DOCUMENSO_FILES_HOST}` (not
the container name) and MinIO gets its own Traefik route — otherwise the signing
page renders a blank document. The backend keeps using the container name over
`localnet`, so both sides reach the same MinIO.

## Configuration

`compose.yml` reads `documenso.env` (passed via `--env-file`). Committed
defaults make the stack boot immediately; **any GitLab CI/CD variable of the
same name overrides the file** (the job's shell env wins). Override at minimum
before production:

- `DOCUMENSO_HOST` / `DOCUMENSO_FILES_HOST` — the Traefik hostnames for the
  signing page and MinIO. Both need DNS pointing at the Traefik host.
- `DOCUMENSO_API_TOKEN` — `api_<random>`; the backend's Bearer token, seeded
  into Documenso by `seed-token.sh` (mask it; same value in the backend jobs).
- `NEXTAUTH_SECRET`, `NEXT_PRIVATE_ENCRYPTION_KEY`,
  `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` — `openssl rand -base64 32`
- `POSTGRES_PASSWORD`
- Signing cert (below)

## API token (headless — no UI)

Because the UI is never exposed, the token is **not** created in the dashboard.
`seed-token.sh` (run automatically at the end of the deploy job) inserts a
service user + the token into `documenso-db`, storing `sha512(DOCUMENSO_API_TOKEN)`
— exactly what Documenso checks on each Bearer call. Set `DOCUMENSO_API_TOKEN`
once as a masked CI/CD variable; it is idempotent and re-runs safely.

## Signing certificate

Provide the `.p12` as a **base64 string** (no host file mount needed):

```bash
openssl base64 -A -in cert.p12
```

Set the output as the `NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS` CI/CD variable
and `NEXT_PRIVATE_SIGNING_PASSPHRASE` to its passphrase. Until then the app
boots with signing disabled (check `/api/certificate-status`).

## Prerequisites on the host runner

- The external Docker network exists: `docker network create localnet` (already
  present if the backend/frontend deploy there).
- Traefik is running with the `godaddy` cert resolver + `websecure` entrypoint
  (same setup the backend/FE use).
- DNS for `DOCUMENSO_HOST` and `DOCUMENSO_FILES_HOST` resolves to the Traefik
  host (the `*.s2.ttpprojects.com` wildcard already covers the defaults).

## Manual ops (on the host)

```bash
cd deploy/documenso
docker compose --env-file documenso.env up -d   # start / update
docker compose ps
docker compose logs -f documenso
docker compose --env-file documenso.env down     # stop (keeps volumes)

# Provision / refresh the backend's API token (idempotent):
set -a; . ./documenso.env; set +a
DOCUMENSO_API_TOKEN=api_xxxxx bash seed-token.sh
```

The token is provisioned headlessly by `seed-token.sh` (run automatically by the
deploy job) — no UI signup needed.
