#!/bin/sh

# Migrations
pnpm run prisma migrate deploy

# Start
npm run start:prod
