import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  await rm("public", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Copy built files to public directory for PHP deployment
  console.log("copying to public directory...");
  const { cp } = await import("fs/promises");
  await cp("dist/public", "public", { recursive: true });

  // Note: Server is now PHP, no need to build Node.js server
  console.log("Build complete! Frontend is ready for PHP deployment.");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
