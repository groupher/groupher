# Code Documentation Audit

Audit code documentation against the current implementation and business boundaries. Treat `docs/` as supporting domain context, not as this skill's audit target.

## Scope

Include:

- Elixir `@moduledoc` and public `@doc` coverage.
- JS/TS documentation on shared exported callables.
- Python module docstrings.
- ASCII flows that show a module's business position and major handoffs.
- Application-level source READMEs covered by the repository checker.
- Existing comments whose ownership, flow, API, or runtime claims have become stale.

Exclude unless the user explicitly expands the task:

- Status classification, movement, or rewriting of documents under `docs/`.
- Generic inline comments that merely narrate implementation syntax.
- Tests, fixtures, generated files, route components, and local Salon factories excluded by the current checker.
- Product or executable-code refactors discovered during the audit.

## Workflow

1. Determine whether the request is read-only audit, focused repair, repository sweep, or documentation-only delivery. Do not edit until the user authorizes changes.
2. Read `scripts/check-documentation.mjs` before relying on its coverage because its explicit roots and boundary lists can evolve.
3. Run the root `docs:check` script with the package manager declared by `package.json` (`pnpm docs:check` currently) to capture the automated baseline. Attribute each finding to the audited scope; do not blame focused changes for unrelated existing failures. If dependencies are unavailable, report that validation gap instead of installing packages or changing the lockfile without authorization.
4. For structural meaning, use CodeGraph to inspect the documented module or callable, its callers, callees, and ownership. Use `rg` only for literal documentation markers or residual wording.
5. Consult the smallest relevant file under `docs/` when business semantics are unclear. If implementation and documentation still do not establish the meaning, list the unresolved item instead of inventing prose or examples.
6. Audit existing documentation as well as missing documentation. Check that it describes the current owner, problem solved, input/output boundary, side effects, errors, and major cross-module handoffs where those details matter.
7. When repair is authorized, change documentation only. Preserve executable behavior and unrelated dirty-worktree changes. Do not add placeholder examples, generic templates, or field-by-field narration.
8. Re-run the repository checker and validation appropriate to the touched language. Also run `git diff --check` and inspect the final diff for accidental behavior changes.

## Documentation Standard

### Modules

Explain why the module exists, what it owns, what it delegates, and where it sits in the business flow. Include a concise ASCII flow for modules required by the checker. A small schema, seed, support, or adapter module still needs an accurate boundary description; it does not need exhaustive field prose.

### Public callables

Document the purpose or problem solved rather than restating the function name or type signature. Include non-obvious side effects, error/result semantics, caching, authorization, or lifecycle constraints when they affect callers.

### Examples

Use examples only when the real call and arguments are verified. Never generate placeholder `iex>` calls or speculative API usage to satisfy coverage mechanically.

## Coverage Limits

The root `docs:check` script is the repository regression gate, not proof of complete semantic coverage. In particular, its Elixir public-function audit follows explicit shared and boundary lists rather than every deep production module. When the user requests complete domain or repository coverage, perform an additional scope inventory and report both:

- automated checker results;
- semantic or deep-coverage findings outside the checker.

Do not report a clean repository-wide audit when only the configured gate or a focused subset passed.

## Completion Report

State:

- the audited scope;
- missing, stale, and unresolved documentation separately;
- automated checker results and any unrelated baseline failures;
- additional semantic/deep-coverage findings;
- files changed and language-specific validation when repair was requested;
- whether commit or push was requested and performed.
