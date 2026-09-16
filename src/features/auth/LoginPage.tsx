import { useState, type FormEvent } from "react";

type Props = {
  error: string;
  onLogin: (username: string, password: string) => Promise<void>;
};

function LoginPage({ error, onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onLogin(username, password);
    setPassword("");
  };

  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">Backend Engineering Notes · Admin</p>
        <h1>Interview content system</h1>
        <p className="muted">Sign in to manage the notes published by the public site.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
