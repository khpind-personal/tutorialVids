import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Sign in</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (login(u, p)) nav("/dashboard");
        else setErr("Invalid credentials. Try demo / demo.");
      }}>
        <div><label>Username <input data-test="username" name="username" value={u} onChange={(e) => setU(e.target.value)} /></label></div>
        <div><label>Password <input data-test="password" name="password" type="password" value={p} onChange={(e) => setP(e.target.value)} /></label></div>
        <button data-test="submit" type="submit">Sign in</button>
        {err && <p role="alert">{err}</p>}
      </form>
    </main>
  );
}
