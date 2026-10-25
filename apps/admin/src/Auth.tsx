import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ArrowRight, ShieldCheck, Leaf, Droplets } from "lucide-react";
import { auth, api, setDemoToken } from "./api";
import { Brand, Field, FormError } from "./components";
export default function Auth({
  mode,
  refresh,
  roles = ["admin", "customer", "dealer"],
}: {
  mode: string;
  refresh: () => Promise<void>;
  roles: string[];
}) {
  const [role, setRole] = useState(roles[0]),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [business, setBusiness] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (!auth)
        throw new Error(
          "Firebase sign-in is not configured. Add the VITE_FIREBASE variables and redeploy.",
        );
      setDemoToken("");
      if (register) {
        await createUserWithEmailAndPassword(auth, email, password);
        await api("/profile", "POST", {
          name,
          phone,
          role,
          businessName: business,
        });
      } else await signInWithEmailAndPassword(auth, email, password);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setError("");
    setInfo("");
    try {
      if (!auth || !email) throw new Error("Enter your email address first.");
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset requested. Check your inbox.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-copy">
          <div className="eyebrow">
            <Leaf size={16} /> EVERY DROP, CONNECTED
          </div>
          <h1>
            Better water.
            <br />
            Better everyday.
          </h1>
          <p>
            One thoughtful workspace for your products, partners, and the people
            you serve.
          </p>
          <div className="auth-orbit">
            <Droplets size={100} />
            <span>
              CALIFNCO
              <br />
              <b>WATER CARE</b>
            </span>
          </div>
        </div>
        <div className="auth-footer">Commerce · Service · Connections</div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <div className="eyebrow">WELCOME TO CALIFNCO</div>
          <h2>
            {register ? "Create your account" : "A fresh start, every day."}
          </h2>
          <p className="muted">
            {register
              ? "Join our water care community."
              : "Sign in to your workspace to keep things flowing."}
          </p>
          <div className="segmented">
            {roles.map((r) => (
              <button
                key={r}
                className={r === role ? "active" : ""}
                onClick={() => {
                  setRole(r);
                  setRegister(false);
                  setError("");
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            {register && (
              <>
                <Field label="Full name">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                {role === "dealer" && (
                  <Field label="Business name">
                    <input
                      required
                      value={business}
                      onChange={(e) => setBusiness(e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}
            <Field label="Email address">
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={8}
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <FormError error={error} />
            {info && (
              <p className="success" role="status">
                {info}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-links">
            <button onClick={reset}>Forgot password?</button>
            {role !== "admin" && (
              <button onClick={() => setRegister(!register)}>
                {register ? "Already registered? Sign in" : "Create an account"}
              </button>
            )}
          </div>
          {mode === "local-demo" && (
            <div className="demo-login">
              <p>Local demonstration · no real payments or messages</p>
              <button
                className="secondary full"
                onClick={async () => {
                  setDemoToken("demo-" + role);
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Explore as {role}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {mode === "setup-required" && (
            <p className="setup-note">
              Connect Firebase to activate sign-in. Deployment instructions are
              included in <code>docs/SETUP.md</code>.
            </p>
          )}
          {mode !== "local-demo" && (
            <div className="demo-login">
              <p>Explore sample data · no live transactions</p>
              <button
                className="secondary full"
                onClick={async () => {
                  setDemoToken("browser-demo:demo-" + role);
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Explore as {role}
                <ArrowRight size={16} />
              </button>
              <p className="muted">
                Sample changes stay in this browser tab. Live accounts require
                Firebase setup.
              </p>
            </div>
          )}
          <div className="secure-note">
            <ShieldCheck size={15} /> Live account access is verified by the
            server.
          </div>
        </div>
      </section>
    </div>
  );
}
