import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@shared/schema";

/**
 * Database Configuration for Local Development
 * 
 * ⚠️ IMPORTANT: This Node.js server is for LOCAL DEVELOPMENT ONLY
 * - Uses MariaDB/MySQL
 * - Requires DB_HOST, DB_NAME, DB_USER, DB_PASS in your environment
 * - See env.example.production and DEPLOYMENT.md
 */
const host = process.env.DB_HOST || "127.0.0.1";
const database = process.env.DB_NAME;
const user = process.env.DB_USER;
const password = process.env.DB_PASS;
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

if (!database || !user || !password) {
  throw new Error(
    "MariaDB configuration missing.\n\n" +
    "Set DB_HOST, DB_NAME, DB_USER, DB_PASS in your .env for local MariaDB.\n" +
    "Example:\n" +
    "  DB_HOST=127.0.0.1\n" +
    "  DB_NAME=auction\n" +
    "  DB_USER=ussd_user\n" +
    "  DB_PASS=your_password\n",
  );
}

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = drizzleMysql(pool, { schema, mode: "default" });
const dbDialect = "mysql";

export { db, dbDialect };
