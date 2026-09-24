# publish-to-github

Publish the Cook & Bake Academy static website to GitHub Pages.

## Steps

1. Check repository status:
   ```powershell
   git status --short --branch
   ```
2. Run a local sensitive-data scan before staging:
   ```powershell
   rg -n --hidden --glob '!/.git/**' --glob '!cook-bake-market-validation/.git/**' "(api[_-]?key|secret|token|password|BEGIN (RSA|OPENSSH|PRIVATE) KEY|AKIA[0-9A-Z]{16})"
   ```
   Investigate every match before publishing.
3. Review site files and confirm no generated local sign-up data is committed.
4. Stage, commit, and push:
   ```powershell
   git add README.md AGENTS.md admin.html index.html css data js market-brief.md cook-bake-academy-market-report.html .github/workflows/pages.yml .agents/commands/publish-to-github.md
   git commit -m "Publish Cook and Bake Academy site"
   git push origin main
   ```
5. Confirm the GitHub Pages workflow completes successfully and publishes the `gh-pages` branch.
6. Share the live URL:
   ```text
   https://whkwok.github.io/cook-n-bake/
   ```

## Notes

- GitHub Pages must be configured to use GitHub Actions.
- `data/courses.json` is the source of truth for course fees and intakes.
- Do not commit secrets, credentials, browser exports, or real student sign-up records.
