## Terminal rules

Never use `cd path; command`.

Use the current working directory or `git -C`.

Examples:

Wrong:
`cd F:\HouseLog\house-log-back\apps\api; npx wrangler deploy --dry-run --outdir dist`

Correct:
`npx wrangler deploy --dry-run --outdir dist`

Wrong:
`cd F:\HouseLog; git log --all`

Correct:
`git -C F:\HouseLog log --all`