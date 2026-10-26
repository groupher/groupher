# Review AI Worker

This Worker adapts the Groupher moderation judge HTTP contract to Cloudflare Workers AI Clef-flash.

```text
Groupher ReviewBot
  -> AI.check
  -> JudgeHTTP POST /v1/judge
  -> this Worker
  -> env.AI.run(@cf/cloudflare/clef-flash)
  -> existing OpinionOutput contract
```

The Worker accepts the existing `JudgeHTTP` request body and requires `REVIEW_BOT_TOKEN` as a Bearer token. It builds Clef's `state + questions` input from the system policy, community policy, banned terms, title, and body, then maps Clef's typed decisions into `clear`, `suspect`, or `uncertain`.

## Local run

1. Copy `.dev.vars.example` to `.dev.vars` and replace the local token.
2. Run `pnpm install` from the repository root once after adding this workspace.
3. Start the Worker with `pnpm --filter @groupher/review-ai-worker dev`.
4. Configure the Phoenix backend's existing `REVIEW_BOT_JUDGE_URL` and `REVIEW_BOT_JUDGE_TOKEN` to the local Worker URL and the same token, and set `REVIEW_BOT_PROFILE_ID=judge_http`. Local dev/test accepts loopback HTTP; production still requires HTTPS.

Workers AI is remote even while the Worker runs locally, so test requests consume the account's Workers AI allocation.

## Current boundary

This first path supports text moderation. Requests that require image moderation return 422 so the existing review cannot incorrectly treat unreviewed images as clear. Clef's decision API returns typed choices and probabilities rather than generated evidence spans; the Worker preserves the current opinion format with the submitted body excerpt and a transparent category explanation. Paragraph-level editor anchors need a separate content-structure change because the present `AI.OpinionInput` carries flattened title/body text.

The Worker is not deployed by these local commands. After deployment, set `REVIEW_BOT_TOKEN` as a Worker secret and point the Phoenix judge profile at its HTTPS URL.
