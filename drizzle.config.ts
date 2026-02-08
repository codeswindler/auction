import { defineConfig } from "drizzle-kit";

const host = process.env.DB_HOST || "127.0.0.1";
const database = process.env.DB_NAME;
const user = process.env.DB_USER;
const password = process.env.DB_PASS;
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

if (!database || !user || !password) {
  throw new Error("Missing DB_HOST, DB_NAME, DB_USER, or DB_PASS for MariaDB.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    host,
    user,
    password,
    database,
    port,
  },
});
