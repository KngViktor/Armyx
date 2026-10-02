#!/bin/sh
# Streaming read replica: clone the primary on first start, then run in hot-standby mode.
set -e
export PGDATA=/var/lib/postgresql/data
until pg_isready -h postgres -U armyx; do sleep 1; done
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  pg_basebackup -h postgres -U replicator -D "$PGDATA" -R -X stream -P
  chmod 700 "$PGDATA"
fi
exec postgres -c hot_standby=on
