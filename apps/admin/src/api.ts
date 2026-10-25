import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import type { Profile } from "../../../shared/types";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const auth =
  config.apiKey && config.projectId
    ? getAuth(getApps()[0] || initializeApp(config))
    : null;
if (auth && import.meta.env.VITE_AUTH_EMULATOR_URL)
  connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL, {
    disableWarnings: true,
  });
export let demoToken = sessionStorage.getItem("califnco-demo-token") || "";
export function setDemoToken(value: string) {
  demoToken = value;
  if (value) sessionStorage.setItem("califnco-demo-token", value);
  else sessionStorage.removeItem("califnco-demo-token");
}
export const isBrowserDemo = () => demoToken.startsWith("browser-demo:");
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (isBrowserDemo()) {
    const { demoApi } = await import("./browserDemo");
    return demoApi(path, method, body, demoToken);
  }
  const token = demoToken || (await auth?.currentUser?.getIdToken());
  const response = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "API unavailable. Verify the Vercel root and API deployment.",
    );
  }
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export type Session = {
  profile: Profile | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
