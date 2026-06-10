# Gemini Vertex AI — Local Setup

For developers running Peer locally with a Google Cloud Vertex AI service-account JSON key. Once the BYOK UI ships (see [BLUEPRINT_byok_and_providers.md](BLUEPRINT_byok_and_providers.md)), end users won't need this — they'll paste their key into the app instead. This walkthrough is for the operator-mode env-var path.

## What you have

A `.json` service-account key file from GCP. It looks like:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-sa@your-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

⚠️ **This file is a credential.** Treat it like a password. Never commit it to git, never paste it into Slack, never include it in screenshots.

## Step 1 — Place the JSON file outside the repo

Pick a location your dev machine controls but git doesn't see. On Windows:

```
C:\Users\wbc13\.gcp\peer-vertex-key.json
```

Copy your downloaded `.json` file there. **Do not put it inside the `Peer/` folder.**

## Step 2 — Verify the service account has Vertex AI access

In the Google Cloud Console:

1. Open the project that owns the key (`project_id` in the JSON)
2. Go to **IAM & Admin → IAM**
3. Find the service-account email (`client_email` in the JSON)
4. It needs the role **Vertex AI User** (`roles/aiplatform.user`)
5. If missing, click the pencil icon and add it

Also confirm the **Vertex AI API** is enabled:
- **APIs & Services → Library → Vertex AI API → Enable**

## Step 3 — Pick a region

Vertex models are region-scoped. Recommended for general use:
- `us-central1` (most models, lowest latency from US)
- `us-east5` (Claude on Vertex)
- `europe-west4` (EU users)

Pick one. You'll set it in env config below.

## Step 4 — Install the SDK in the web project

```bash
cd web
npm install @google-cloud/vertexai
```

## Step 5 — Configure env vars

Create or edit `web/.env.local`:

```
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\wbc13\.gcp\peer-vertex-key.json
GOOGLE_VERTEX_PROJECT=your-project-id-from-the-json
GOOGLE_VERTEX_LOCATION=us-central1
PEER_DIGEST_PROVIDER=gemini
```

Notes:
- `GOOGLE_APPLICATION_CREDENTIALS` is the standard env var the Google SDK looks for. It must be an **absolute path** to the JSON file.
- `PEER_DIGEST_PROVIDER` is the new switch — when set to `gemini`, `/api/digest` will route through the Gemini provider instead of Anthropic. (This switch ships in Step 2 of the BYOK migration plan.)

⚠️ Make sure `web/.env.local` is in `.gitignore`. Confirm with:
```bash
git check-ignore -v web/.env.local
```
Should print a match.

## Step 6 — Verify with a quick smoke test

After the Gemini provider lands in the codebase, a smoke command will live at `web/scripts/test-gemini.ts`. Until then, test the credential file is readable with:

```bash
node -e "require('@google-cloud/vertexai'); console.log('SDK loaded'); require('fs').accessSync(process.env.GOOGLE_APPLICATION_CREDENTIALS); console.log('Credential file readable');"
```

## Step 7 — Restart the dev server

```bash
npm run dev
```

The digest paragraph should populate within a few seconds of the feed loading, served by Gemini instead of Claude.

## Cost expectations

- Gemini 2.0 Flash on Vertex: roughly **$0.0001 per 1K input tokens, $0.0004 per 1K output tokens** (check console for current pricing)
- A daily digest of 10 papers consumes roughly 6-8K input tokens + 1-2K output ≈ **fractions of a cent per run**
- Add a budget alert in GCP **Billing → Budgets & alerts** to cap monthly spend if you're cautious

## Switching back to Anthropic (or off entirely)

In `web/.env.local`:
```
# To use Anthropic instead
PEER_DIGEST_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Or to disable LLM features (Tier 0)
# (just remove or comment out PEER_DIGEST_PROVIDER and the API keys)
```

The app gracefully drops the digest when no provider is configured.

## When the BYOK UI ships

End users will not touch env vars. They'll go to **Settings → AI Provider**, pick **Gemini Vertex**, and paste:
- `project_id`
- `client_email`
- `private_key`

(The full `.json` will be parsed in the browser, only the three fields above will be sent to the server, and they'll be stored encrypted in Supabase. See the BYOK blueprint for the security model.)

This dev-mode env-var setup is just the on-ramp until that UI exists.
