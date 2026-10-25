import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
const app = process.env.CALIFNCO_APP || "automation";
if (!["admin", "storefront", "automation"].includes(app))
  throw new Error("CALIFNCO_APP must be admin, storefront or automation");
execFileSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build", "--workspace", `apps/${app}`],
  { stdio: "inherit" },
);
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync(`apps/${app}/dist`, "dist", { recursive: true });
console.log(`Prepared ${app} as an independent Vercel deployment.`);
