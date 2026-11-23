import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env on its own, so CLI commands (db push,
// migrate, studio) would otherwise see DATABASE_URL as undefined. Variables
// already set in the environment win, and a missing .env (e.g. in the Docker
// image, where env comes from docker-compose) is silently ignored.
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
