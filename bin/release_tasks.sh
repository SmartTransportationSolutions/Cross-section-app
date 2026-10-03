#!/bin/bash
# Release-phase tasks: run after a build and before the new version starts
# serving traffic (Docker entrypoint, Heroku release phase, CI deploy step).
set -euo pipefail

# Migrate PostgreSQL database
npx sequelize-cli db:migrate
