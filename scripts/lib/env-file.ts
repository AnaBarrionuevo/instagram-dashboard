import fs from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

/** Updates or appends a key in .env.local. */
export function setEnvLocal(key: string, value: string): void {
  if (!fs.existsSync(ENV_PATH)) {
    fs.writeFileSync(ENV_PATH, `${key}=${value}\n`, "utf8");
    return;
  }

  const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
  let found = false;

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    if (trimmed.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${key}=${value}`);
  }

  fs.writeFileSync(ENV_PATH, updated.join("\n").replace(/\n*$/, "\n"), "utf8");
}
