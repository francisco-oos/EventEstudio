#!/bin/sh
set -eu

storage_root="${STORAGE_ROOT:-/app/storage}"
mkdir -p "$storage_root/data/temp" "$storage_root/uploads/guest-photos" "$storage_root/uploads/site-media" "$storage_root/backups"
chown -R node:node "$storage_root"

exec gosu node "$@"
