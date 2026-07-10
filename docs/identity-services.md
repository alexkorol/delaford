# Identity and Role-Play Name Validation

Delaford now validates character names server-side before they can be bound to an account. This document outlines how the
validation pipeline works, what operational considerations apply, and how to override decisions when moderation is required.

## Pipeline overview

1. **Client request** – The character creation UI posts the desired name and the player's account identifier to
   `POST /api/identity/name-validations`.
2. **Job creation** – The server creates an asynchronous validation job. Cached decisions are returned immediately, otherwise
   the job is enqueued and processed by the configured provider.
3. **Provider decision** – The name is evaluated by the configured provider (LLM or the built-in heuristic fallback). Results are
   cached and written to the identity registry.
4. **Identity binding** – Successful validations automatically bind the normalized name to the account in the identity registry.
5. **Polling** – The client polls `GET /api/identity/name-validations/:jobId` until the job completes and then refreshes the
   account identity view via `GET /api/identity/accounts/:accountId`.

## Provider configuration

The validation provider is selected with environment variables:

- `NAME_VALIDATION_PROVIDER` – `http` to forward to an external LLM endpoint, defaults to `local` heuristic validation.
- `NAME_VALIDATION_ENDPOINT` – URL for the upstream service when using the `http` provider.
- `NAME_VALIDATION_API_KEY` – Optional Bearer token supplied with upstream requests.
- `NAME_VALIDATION_CACHE_TTL` – Cache lifetime in milliseconds (default 15 minutes).
- `NAME_VALIDATION_MIN_LENGTH` / `NAME_VALIDATION_MAX_LENGTH` – Bounds enforced before a provider call.

## Rate limits and batching

- Requests are serialized through an in-memory queue to avoid overwhelming the upstream model. Only one name is processed at a
  time by default. Adjust queue throughput by forking the service if higher parallelism is required.
- Cached results are returned instantly and also re-recorded against the requesting account, ensuring downstream systems see
  consistent history without re-hitting the model.
- The HTTP endpoint accepts payloads up to 32 KB (`express.json({ limit: '32kb' })`). Keep client submissions small to avoid
  rejection.

## Moderation overrides

- All validation attempts (successes and failures) are stored in SQLite (`server/data/verdigris.sqlite` by default). The latest successful
  decision is treated as the bound identity.
- To override a decision, edit the JSON entry for the account, adjust `boundIdentity`, and remove or annotate the previous
  history entry. Restarting the server will reload the modified state.
- When forcing a new identity, create a new validation job (with the desired name) so the history captures the override and the
  cache is refreshed.

## Operational checklist

- Monitor the identity store file for growth; rotate or archive it if it becomes large.
- Ensure upstream LLM quotas are sized for peak registration bursts. The queue will cause back-pressure when the provider is
  slow or rate limited.
- When disabling the LLM provider (e.g., outage), set `NAME_VALIDATION_PROVIDER=local` to fall back to the deterministic
  heuristic rules. Communicate to moderators that manual review may be required for borderline cases during fallback mode.
