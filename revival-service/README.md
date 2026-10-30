# Ghostlight Revival Relay service

This service restores one packaged fictional exhibit. It recovers a title, migrates an old guest ledger and reconnects an original SVG asset. Visitors inspect the three changes and explicitly approve them before a Temporal workflow runs the bounded Mastra tools.

After the title output is committed, the worker opens a 20-second interruption window. The interrupt endpoint sends the actual worker `SIGKILL` and starts a replacement process. Temporal retries the incomplete Activity after its heartbeat timeout. The replacement verifies the expected bytes and adopts the existing output before completing the remaining repairs. A completed run exposes an inspectable exhibit and a JSON capsule.

This is a controlled failure rehearsal, not arbitrary software repair. Only the packaged original fixture can be processed. No uploaded files, URLs, prompts, commands or private archives are accepted. Model-based suggestions happen in the visitor application; this API validates the finite tool IDs and requires separate approval. It does not claim a model generated the repairs.

## Run

Use Node 22 or newer and Temporal CLI 1.9.1 on PATH, then:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm start
```

`PORT` defaults to 8080. The API is public on that port; Temporal's gRPC, HTTP and metrics services bind only to loopback ports 17433, 18234 and 19234. `TEMPORAL_BIN` selects an installed CLI path. `DATA_DIR` selects the ephemeral sandbox. Do not run against an existing Temporal installation on these ports.

`npm run verify:live` starts an isolated real HTTP service, approves the fixed repairs, interrupts the worker and checks Temporal retry, verified adoption, three final outputs, duplicate approval and the public exhibit. It requires the CLI location selected by `TEMPORAL_BIN`; its local fallback is a temporary installation path and should be overridden on another machine. `proof-result.json` is local execution evidence, excluded from deployment.

## HTTP contract

- `GET /health.json` returns readiness and the explicit ephemeral-storage boundary.
- `POST /api/runs` with exactly `{"toolIds":["recover_title","upgrade_ledger","reconnect_asset"]}` creates a preview and returns an opaque run ID and token. Reordering those three IDs is allowed. No other fields or capabilities are accepted.
- Per-run requests require `X-Run-Token`. `GET /api/runs/:id` returns phase, safe events, interruption availability and the verified result.
- `POST /api/runs/:id/approve` with `{"approved":true}` starts work. Repeated approval does not start a second workflow.
- `POST /api/runs/:id/interrupt` with `{}` kills the worker only during the interruption window. Without interruption, the worker continues when the window closes.
- `GET /api/runs/:id/capsule` downloads the verified completed result.
- `GET /exhibits/:id` renders only a completed fixed fictional exhibit. It is intentionally public and contains no run token or uploaded visitor data.

The default allowed browser origin is the Ghostlight Hugging Face static application. `ALLOWED_ORIGINS` accepts comma-separated explicit application origins; local development origins are allowed. Tokens must be sent in headers, not URLs. The demo permits one active restoration, at most 24 retained runs, 60 new previews per hour globally and 240 API requests per minute per source address. Previews expire after 15 minutes. Workflows have an 180-second execution bound and at most three attempts per tool.

## Container and hosting boundary

The Dockerfile installs a checksum-verified official Temporal CLI, installs the pinned Node lockfile and prebundles workflow code during the build. Runtime workers use that bundle with one task/activity slot and no workflow cache. The container runs as the unprivileged `node` user. Use this directory as the Docker build context/root directory, Dockerfile `Dockerfile`, health path `/health.json`, and the host-provided `PORT`.

The SQLite service database and run files live on the instance's **ephemeral disk**. They survive the child worker death demonstrated here; they are not guaranteed across instance replacement, redeployment, free-host suspension or disk loss. The API's run index is in process memory. No production durability, high availability, exactly-once execution or tested multi-writer guarantee is claimed. A cold free instance can take time to start. Deployment resource limits must be verified on the actual host.

## Optional Sentry tracing

`SENTRY_DSN` enables manually instrumented approval, workflow, repair and worker-exit spans. With no DSN the service runs without telemetry delivery. The SDK disables default integrations and default PII, uses the static trace lifecycle and filters error/transaction/span envelopes to fixed metadata. Source text, queries, paths, arbitrary exceptions, files, vectors, request bodies, user identity and attachments are excluded. The test transport checks a private sentinel cannot appear in captured error or trace payloads. Local sentinel tests are not proof of delivery to a Sentry project.

The surviving API records the controlled worker exit; the killed worker cannot flush its own span. Retry attempts and output-adoption attributes come from actual Activity execution. Telemetry errors do not authorize more tools or change Temporal workflow decisions.

App, fixture and repair code: Apache-2.0. Mastra, Temporal, Express, Zod and Sentry retain their own package licences. No credentials are included.
