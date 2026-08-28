FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN npm install --global pnpm@12.0.0
RUN pnpm --version
ENV HUSKY=0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/press/package.json backend/press/package.json
COPY packages/service/package.json packages/service/package.json
COPY packages/contracts/package.json packages/contracts/package.json

# The image intentionally copies only Press and its two workspace dependencies;
# the repository lockfile also contains unrelated workspaces, so this focused
# build install resolves the reduced workspace graph.
RUN pnpm install --frozen-lockfile --filter @groupher/press...

COPY backend/press backend/press
COPY packages/service packages/service
COPY packages/contracts packages/contracts

RUN pnpm --filter @groupher/press run build

# Create a portable production directory. Copying the workspace's original
# node_modules after moving it from /app/backend/press to /app/press can break
# relative symlinks, while deploy materializes an isolated dependency layout.
RUN pnpm --filter @groupher/press --prod deploy /app/deploy

FROM node:24-bookworm-slim AS runtime

WORKDIR /app/press

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8003

COPY --from=build /app/deploy ./

EXPOSE 8003

CMD ["node", "dist/server.js"]
