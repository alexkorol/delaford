> Archived: completed or superseded implementation plan retained for historical context.

# Dependency & Tooling Plan

## Summary
- Current stack: Vue 2.7 + Vue CLI, Node 22, Webpack-based build, Jest 27.
- Major upgrade targets: Vue 3, Vite (or Vue CLI 5 -> Vite), Jest 30, ESLint 9, Express 5.
- Supporting tools: cross-env (update), uuid, eslint-plugin-vue, vue-tippy.

## Proposed Phases

### Phase 0 – Inventory (done)
- Captured outdated packages via `npm outdated --json`.
- Baseline Node/npm versions already tracked through Volta.

### Phase 1 – Low-risk bumps
- `cross-env` v10 (check Windows compatibility).
- `uuid` v13 (audit breaking changes, mostly import syntax).
- `eslint` v8 -> v9 (requires config updates; coordinate with eslint-plugin-vue v10).
- `eslint-plugin-vue` v10 (update lint config).
- `vue-tippy` latest (verify Vue 2 compatibility; otherwise hold for Vue 3 migration).

### Phase 2 – Testing & build tooling
- `jest` 27 -> 30 (requires Babel/Jest config updates, `@vue/vue2-jest` interplay).
- `babel-jest`, `@vue/test-utils`, `@vue/vue2-jest` upgrade path.
- Evaluate switching to `vitest` once Vue 3 migration is planned.

### Phase 3 – Core framework migration
- Vue 2.7 -> Vue 3.x.
- Replace Vue CLI with Vite (new build scripts, alias config, env loading).
- Update component syntax (composition API, global API changes).
- Replace `vuex` with `pinia` or upgrade to Vuex 4 (compatible with Vue 3).
- Replace `vue-template-compiler` with `@vue/compiler-sfc`.

### Phase 4 – Server upgrades
- Express 4 -> 5 (async middleware, router changes).
- Review `ws`, `axios` latest versions.
- Modernise Babel config or consider native ESM.

### Phase 5 – Cleanup & automation
- Replace npm-run-all with native npm workspaces or `concurrently`.
- Add lint-staged tasks for docs/markdown.
- Configure GitHub Actions (lint/test/build).

## Open Questions
- Should we target Vue 3 + Pinia directly or maintain Vuex via compatibility builds?
- Do we need SSR or prerendering as part of Vite migration?
- Keep Babel or rely on Vite/esbuild/ts? Consider TypeScript adoption.

## Next Steps
1. Apply Phase 1 upgrades in a dedicated branch (run lint/tests, smoke test).
2. Draft RFC for Vue 3 + Vite migration including timeline and risks.
3. Prototype inventory grid feature after toolchain stable.
