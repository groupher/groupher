FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN corepack enable
ENV HUSKY=0

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY backend/press/package.json backend/press/package.json
COPY packages/service/package.json packages/service/package.json
COPY packages/contracts/package.json packages/contracts/package.json

# The image intentionally copies only Press and its two workspace dependencies;
# the repository lockfile also contains unrelated workspaces, so this focused
# runtime install must be allowed to resolve its reduced workspace graph.
RUN yarn install

COPY backend/press backend/press
COPY packages/service packages/service
COPY packages/contracts packages/contracts

RUN yarn workspace @groupher/press build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app/press

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8003

RUN corepack enable

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/press /app/press
COPY --from=build /app/packages/service /app/packages/service
COPY --from=build /app/packages/contracts /app/packages/contracts

EXPOSE 8003

CMD ["node", "dist/server.js"]
