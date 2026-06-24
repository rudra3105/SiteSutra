const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, "..", ".env"));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

const backupDir = path.join(__dirname, "..", "backups");
fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(backupDir, `backup_${timestamp}.dump`);

console.log(`Backing up database to ${outFile} ...`);

const result = spawnSync(
  "npx",
  ["--yes", "supabase", "db", "dump", "--db-url", dbUrl, "-f", outFile],
  { stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  console.error("Backup failed");
  process.exit(result.status ?? 1);
}

console.log("Backup complete.");
