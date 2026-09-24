# Cook & Bake Academy

[![Static HTML](https://img.shields.io/badge/site-static%20HTML-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/styles-CSS-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/app-vanilla%20JavaScript-F7DF1E?logo=javascript&logoColor=222)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=github&logoColor=white)](https://whkwok.github.io/cook-n-bake/)

Cook & Bake Academy is a framework-free static website for a Singapore cooking and baking school. It presents the course catalogue, filters courses by category and search, supports a local course assistant, captures browser-only sign-ups, and provides an admin CSV export page.

Live site: https://whkwok.github.io/cook-n-bake/

## Overview

The public site is built for a small hands-on academy with two campuses, 20 courses, and course data loaded from JSON. It includes:

- A branded landing page with hero collage and course discovery.
- A course grid rendered from `data/courses.json`.
- Course sign-up through a shared browser dialog with local validation.
- Local-only sign-up storage and CSV export through `admin.html`.
- GitHub Pages deployment through GitHub Actions.

## Architecture

```text
index.html              Public website and shared sign-up dialog
admin.html              Local admin export screen
css/styles.css          Brand system, layout, responsive styles
js/app.js               Course rendering, filters, assistant
js/signup.js            Sign-up validation and localStorage persistence
js/admin.js             CSV export view
data/courses.json       Course catalogue source of truth
.github/workflows/      GitHub Pages deployment workflow
.agents/commands/       Project-level automation commands
```

The site has no build step and no backend. All catalogue details, fees, intakes, and allergens should stay in `data/courses.json`.

## Installation

Clone the repository and run a local static server:

```powershell
git clone https://github.com/whkwok/cook-n-bake.git
cd cook-n-bake
python -m http.server 4180
```

Open `http://127.0.0.1:4180/`.

## Development

Use plain HTML, CSS, and JavaScript. Keep fees and course details out of markup and scripts unless they are read from `data/courses.json`.

Useful checks:

```powershell
$c = Get-Content -Raw data/courses.json | ConvertFrom-Json
$c.Count
@($c | Where-Object cat -eq 'Bakery').Count
@($c | Where-Object cat -eq 'Cooking').Count
```

Expected counts are 20 total, 10 Bakery, and 10 Cooking.

## Publishing

GitHub Pages is deployed by `.github/workflows/pages.yml` on every push to `main`. The workflow publishes the static site to the `gh-pages` branch. The project-level command is documented at `.agents/commands/publish-to-github.md`.

Before publishing, scan for secrets:

```powershell
rg -n --hidden --glob '!/.git/**' --glob '!cook-bake-market-validation/.git/**' "(api[_-]?key|secret|token|password|BEGIN (RSA|OPENSSH|PRIVATE) KEY|AKIA[0-9A-Z]{16})"
```

## About

Cook & Bake Academy is a static course-discovery and sign-up website for hands-on cooking and baking classes in Singapore.

GitHub Pages live link: https://whkwok.github.io/cook-n-bake/
