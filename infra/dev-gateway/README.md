# Dev Gateway

`infra/dev-gateway` is the local HTTP entry for Groupher's active applications.
It proxies local custom hosts to their Vite/TanStack services and handles the
small set of Phoenix, Auth, Press, and static routes that share that entry.

It is development infrastructure only. Production public routing belongs to
`infra/edge-router`.

## Active targets

- Landing
- Community
- Dash
- Apply
- Auth, Phoenix, and Press

## Commands

```bash
yarn workspace @groupher/dev-gateway dev
yarn workspace @groupher/dev-gateway test
yarn workspace @groupher/dev-gateway type-check
yarn workspace @groupher/dev-gateway format:check
```

See [`infra/clean_up.md`](../clean_up.md) for the migration boundary and
[`infra/clean_up.md`](../clean_up.md) for the routing and cleanup contract.
