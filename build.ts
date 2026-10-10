import { NapiCli } from "@napi-rs/cli";
import * as fs from "node:fs";
import * as path from "node:path";

async function run() {
  const args = process.argv.slice(2);
  const isRelease = args.includes("--release") || args.includes("-r");
  const useNapiCross = args.includes("--use-napi-cross");
  const crossCompile = args.includes("--cross-compile") || args.includes("-x");
  const useCross = args.includes("--use-cross");

  const targetIdx = args.findIndex((a) => a === "--target" || a === "-t");
  const target = targetIdx !== -1 && args[targetIdx + 1] ? args[targetIdx + 1] : undefined;

  const cli = new NapiCli();
  await cli.build({
    cwd: process.cwd(),
    platform: true,
    esm: true,
    outputDir: "./dist",
    release: isRelease,
    target,
    useNapiCross,
    crossCompile,
    useCross,
  });

  const distDir = path.join(process.cwd(), "dist");
  const rootDir = process.cwd();

  if (fs.existsSync(distDir)) {
    for (const file of fs.readdirSync(distDir)) {
      if (file.endsWith(".d.ts") || file.endsWith(".js") || file.endsWith(".node")) {
        fs.copyFileSync(path.join(distDir, file), path.join(rootDir, file));
      }
    }
  }
}

void run().catch((err) => {
  console.error(err);
  process.exit(1);
});
