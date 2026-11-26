## Tech Stack

**Web**: [React](https://react.dev/) + [Vite](https://vite.dev/) + [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query) + [Zustand](https://zustand-demo.pmnd.rs/) + [Tailwind CSS](https://tailwindcss.com/)

**Server**: [Express.js](https://expressjs.com/) + [TSOA](https://tsoa-community.github.io/docs/)

**DB**: [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://www.prisma.io/)

**Linting**: [EditorConfig](https://github.com/editorconfig-checker/editorconfig-checker) + [markdownlint](https://github.com/DavidAnson/markdownlint-cli2) + [syncpack](https://jamiemason.github.io/syncpack/) + [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html) + [biome](https://biomejs.dev/) + [ruff](https://docs.astral.sh/ruff/) + [mypy](https://mypy-lang.org/) + [ty](https://docs.astral.sh/ty/)

## Monolith vs Microservice

CMU Maps server is a monolith application. You might wonder why we chose to not use a microservice architecture. Indeed, the Path Finding service needs to construct an in-memory graph, which is a very good use case for a microservice architecture. However, with our scope of CMU community, we would never need to scale to more than one server for the path finding service, so it is just simpler to have a monolith.

## README vs WIKI

Put functionality overview of each directory in README. Otherwise use the Wiki for easy and quick updating.

(I am so tired of syncing between staging and main for README changes... 😮‍💨)

## Perks

### Food

**Free**\* dinner after work session at [98K Halal Fried Chicken & Sandwiches](https://maps.app.goo.gl/4E2vhfQmwPhFzgjm9)!

\*Sponsored by @Yuxiang-Huang (because he wants to cosplay team manager 🙃) and open to five [CMU Maps contributors](https://git.cmu.dev/ScottyLabs/governance/src/branch/main/data/teams/cmu-maps.yaml) each week. If there are too many sign-ups in the CMU Maps Slack channel, we will prioritize based on contribution.

Enjoy a crispy chicken sandwich, the snack of the week, and some Chi Forest to share :>

### Resume

DM your team lead and Yuxiang on Slack for help on Resume bullet points for CMU Maps. Maybe you want to put our MAU on there idk ¯\\\_(ツ)\_/¯
