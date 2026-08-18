# havenwood-eos

Static SPA deployable as a BlueStep GitSite, served under `/spa/`.

Source lives in `app/`. The committed build artifact at the repo root
(`index.html` + `assets/`) **is** what GitSite serves — no server build runs.

## Commands

```
npm install
npm run dev        # local dev server
npm run build      # emits index.html + assets/ to the repo root
npm run typecheck
```

## Deploy

Commit the build output and push to `main`. The BlueStep GitSite
(`hope-eos.bluestep.net`) redeploys on push via webhook.
