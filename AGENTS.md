# Repository Guidelines

## Project Structure & Module Organization

This repository is a framework-free static website. `index.html` contains the public academy page and shared sign-up dialog; `admin.html` lists browser-local sign-ups and exports CSV. Styles live in `css/styles.css`. JavaScript is split by responsibility: `js/app.js` renders and filters courses, `js/signup.js` manages registration, and `js/admin.js` handles the export view. `data/courses.json` is the single source of truth for course details, fees, intakes, and allergens—do not duplicate these values in HTML or JavaScript. Research artifacts are at the root. `cook-bake-market-validation/dist/` is a separately hosted report artifact.

## Build, Test, and Development Commands

There is no build step or package manager. From the repository root, run:

```powershell
python -m http.server 4180
```

Then open `http://127.0.0.1:4180/`. A web server is required because the catalogue is loaded with `fetch()`; opening `index.html` directly may fail. To validate catalogue counts in PowerShell:

```powershell
$c = Get-Content -Raw data/courses.json | ConvertFrom-Json
$c.Count; @($c | Where-Object cat -eq 'Bakery').Count
```

Expected results are `20` and `10`.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, JavaScript, and JSON. Prefer semantic HTML, ES modules, `const`, small functions, and single-quoted JavaScript strings. Use kebab-case for filenames and CSS classes, and descriptive camelCase for JavaScript identifiers. Preserve visible focus states, labels, alt text, `aria-live` updates, and keyboard behavior. Escape catalogue-derived text before inserting it with `innerHTML`. No formatter or linter is currently configured.

## Testing Guidelines

Testing is manual browser-based. Before submitting changes, verify all 20 cards render, category counts remain 10/10, search and combined filters work, and fees match JSON. Exercise sign-up validation, consent/newsletter independence, nut warnings, localStorage persistence, reference generation, mail links, and the exact admin CSV column order. Check keyboard navigation and confirm no horizontal scrolling at 375px. Use a separate local origin or clear test sign-ups after testing.

## Commit & Pull Request Guidelines

The available history uses a concise imperative subject (for example, `Build Cook & Bake market validation report`). Follow that style and keep each commit focused. Pull requests should summarize behavior changes, list manual checks, identify catalogue/schema changes, and include desktop and 375px screenshots for visual work. Link the relevant issue when one exists; never commit personal sign-up data or secrets.
