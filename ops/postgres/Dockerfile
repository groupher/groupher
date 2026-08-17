FROM postgres:15-bookworm AS builder

ARG PG_ROARINGBITMAP_VERSION=1.2.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl unzip make gcc postgresql-server-dev-15 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

RUN curl -fsSLO \
      "https://github.com/ChenHuajun/pg_roaringbitmap/archive/refs/tags/v${PG_ROARINGBITMAP_VERSION}.zip" \
 && unzip "v${PG_ROARINGBITMAP_VERSION}.zip" \
 && cd "pg_roaringbitmap-${PG_ROARINGBITMAP_VERSION}" \
 && make \
 && make install

FROM postgres:15-bookworm

COPY --from=builder /usr/share/postgresql/15/extension/roaringbitmap* /usr/share/postgresql/15/extension/
COPY --from=builder /usr/lib/postgresql/15/lib/roaringbitmap.so /usr/lib/postgresql/15/lib/
COPY --from=builder /usr/lib/postgresql/15/lib/bitcode/roaringbitmap /usr/lib/postgresql/15/lib/bitcode/roaringbitmap
COPY --from=builder /usr/lib/postgresql/15/lib/bitcode/roaringbitmap.index.bc /usr/lib/postgresql/15/lib/bitcode/roaringbitmap.index.bc
