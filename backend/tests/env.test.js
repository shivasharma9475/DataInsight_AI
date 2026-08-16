import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// config.js reads env vars at module-load time, so each scenario needs a
// fresh Node process rather than re-importing within the same test run.
function runInSubprocess(env) {
  return execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import('./src/config/env.js').then(() => console.log('LOADED_OK')).catch(e => { console.error('LOAD_FAILED: ' + e.message); process.exit(1); });",
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      encoding: "utf-8",
    }
  );
}

describe("env.js production secret enforcement", () => {
  it("refuses to start in production without JWT_SECRET/INTERNAL_API_KEY", () => {
    expect(() =>
      runInSubprocess({
        NODE_ENV: "production",
        JWT_SECRET: "",
        INTERNAL_API_KEY: "",
        MONGO_URI: "mongodb://localhost:27017/test",
      })
    ).toThrow();
  });

  it("starts fine in production when real secrets are provided", () => {
    const output = runInSubprocess({
      NODE_ENV: "production",
      JWT_SECRET: "a-real-random-secret",
      INTERNAL_API_KEY: "another-real-random-secret",
      MONGO_URI: "mongodb://localhost:27017/test",
    });

    expect(output).toContain("LOADED_OK");
  });

  it("still starts with dev defaults outside production", () => {
    const output = runInSubprocess({
      NODE_ENV: "development",
      JWT_SECRET: "",
      INTERNAL_API_KEY: "",
      MONGO_URI: "mongodb://localhost:27017/test",
    });

    expect(output).toContain("LOADED_OK");
  });
});
