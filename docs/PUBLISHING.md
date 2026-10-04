# Publishing: GitHub and Vercel

Everything below assumes the repository is `lobinni/pactmark` and that the
live contract address is already committed in `deployments/studionet.json`.
The web app reads the contract from code, so nothing about the deployment
needs environment variables.

## One-shot script

```bash
git clone https://github.com/lobinni/pactmark.git ~/pactmark
sh scripts/publish.sh ~/pactmark push
```

The script copies the updated files over the clone (preserving
`contracts/pactmark.py` and everything else that is not part of the update),
commits with the deployment message and pushes to `origin main`. Drop the
`push` argument to only stage and commit.

## Manual command sequence

```bash
git clone https://github.com/lobinni/pactmark.git
cd pactmark

# merge the updated files over the clone (existing docs, tests and
# contracts/pactmark.py stay untouched), then:
git add -A deployments docs examples frontend scripts tests src public \
  index.html package.json tsconfig.json vite.config.ts vercel.json README.md .gitignore
git rm -rf --ignore-unmatch drizzle.config.json eslint.config.mjs src/app src/db

git commit -m "Record live Studionet deployment and refresh docs, scripts, tests and samples"
git push origin main
```

Useful follow-ups:

```bash
git status                       # confirm the working tree is clean
git log --oneline -5             # confirm the commit landed
git tag live-studionet           # optional marker for the deployment state
git push origin live-studionet
```

## Vercel

`vercel.json` is committed, so the import flow is entirely automatic:

1. Open https://vercel.com/new and import `lobinni/pactmark`.
2. Vercel detects **Vite** and fills in the settings from `vercel.json`:

   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | Install command | `npm install` |
   | Build command | `npm run build` |
   | Output directory | `dist` |

3. **Environment variables: add none.** The app has no database and reads the
   contract address from `deployments/studionet.json` at build time. If an old
   project still defines `DATABASE_URL` or a contract override, delete it in
   Project Settings → Environment Variables; it is unused.
4. Deploy. Every push to `main` redeploys automatically.

Equivalent CLI flow:

```bash
npm install -g vercel
vercel link          # pick or create the project
vercel --prod        # builds with npm run build, publishes dist/
```

## Redeploying the contract later

```bash
python3 scripts/deploy/check_contract.py
PRIVATE_KEY=0x... node scripts/deploy/deploy.mjs
node scripts/deploy/verify_deployment.mjs
git add deployments/studionet.json frontend/assets/config.js
git commit -m "Redeploy Pactmark contract"
git push origin main
```

Vercel rebuilds on the push and serves the new address automatically — code
is the only configuration source.
