# Groupher Apply

`frontend/apply` is the standalone TanStack Start application for community
application and creation flows. It provides the low-frequency, resumable UI
without mounting Main or Dashboard as a fake community.

## Position in the system

```text
User -> Gateway -> Apply
                    |
                    +-> Auth Session
                    +-> Phoenix CommunityApplications GraphQL
                    +-> Assets Hub logo intent/upload
```

Apply owns routes, SSR loading, form steps, local draft recovery, and error
presentation. Phoenix owns eligibility, slug claims, application transitions,
review, and community creation. Assets Hub executes file storage only.

## Local development and validation

```sh
yarn workspace @groupher/frontend-apply dev
yarn workspace @groupher/frontend-apply type-check
yarn workspace @groupher/frontend-apply format:check
yarn workspace @groupher/frontend-apply build
```

Route changes require regenerating the TanStack route tree through the package
script; generated route output is not hand-maintained.

## Related documentation

- [`docs/apply/v1.md`](../../docs/apply/v1.md)
- [`docs/sub-apps/apply.md`](../../docs/sub-apps/apply.md)
- [`docs/auth/v1.md`](../../docs/auth/v1.md)
