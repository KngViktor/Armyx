#!/bin/sh
# Creates the replication role, the CMS database and allows replica connections.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator';
CREATE DATABASE armyx_cms OWNER $POSTGRES_USER;
SQL
echo "host replication replicator all scram-sha-256" >> "$PGDATA/pg_hba.conf"
