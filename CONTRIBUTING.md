# BetterGovPH Status Contributing Guide

<a id="readme-top"></a>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#welcome">Welcome</a></li>
    <li><a href="#project-overview">Project overview</a></li>
    <li><a href="#ground-rules">Ground rules</a></li>
    <li><a href="#proposing-a-new-monitor">Proposing a new monitor</a></li>
    <li><a href="#before-you-start">Before you start</a></li>
    <li><a href="#environment-setup">Environment setup</a></li>
    <li><a href="#contribution-workflow">Contribution workflow</a></li>
    <li><a href="#resources">Resources</a></li>
  </ol>
</details>

## Welcome

Thank you for helping monitor Philippine government online services. Contributions of all kinds are welcome:

- **Monitor definitions** – Add missing government portals or fix outdated URLs
- **Source code** – Fix bugs, add check types, or improve the dashboard
- **Bug reporting** – Report false positives, UI issues, or accessibility gaps
- **Documentation** – Improve guides and operational notes

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project overview

BetterGovPH Status is an edge-native uptime monitor for Philippine government portals, built on Cloudflare Workers and Supabase. To learn more about architecture and goals, see the [README](./README.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Ground rules

Before contributing, please read our [Code of Conduct](./CODE_OF_CONDUCT.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Proposing a new monitor

1. Check `src/data/monitors/curated.json` and `src/data/monitors/imported/*.json` to make sure the host is not already tracked.
2. Add an entry to the appropriate file (or open an issue using the **Add Monitor** template).
3. Ensure `slug` is unique and lowercase kebab-case (`^[a-z0-9-]+$`), and `category` matches `src/data/categories.json`.
4. Run `npm run validate:data` and `npm run test:unit` before opening a PR.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Before you start

- Node.js 22+
- npm 10+
- Docker Desktop (for local Supabase)
- Git

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Environment setup

```sh
git clone https://github.com/bettergovph/bettergovph-status.git
cd bettergovph-status
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contribution workflow

1. Create a feature branch (`feat/add-psa-monitor`, `fix/uptime-bars-tooltip`).
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages (enforced by commitlint).
3. Run checks before opening a PR:

```sh
npm run validate:data
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Resources

- [README](./README.md)
- [Testing Guide](./TESTING.md)
- [Worker Architecture](./functions/README.md)
- [Adding Check Types](./docs/adding-check-types.md)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
