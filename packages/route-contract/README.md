# Groupher Public Route Contract

This workspace owns the runtime-neutral hostname and path classification shared
by the production Cloudflare `edge-router` and the local Node gateway.

It contains no fetch implementation or framework/runtime dependency. Product
routes belong here; HMR, development assets, Portless, and WebSocket routing
remain in the gateway adapter.
