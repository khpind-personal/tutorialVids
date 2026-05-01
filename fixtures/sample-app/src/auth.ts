const KEY = "tv-fixture-session";
export function login(username: string, password: string): boolean {
  if (username === "demo" && password === "demo") {
    localStorage.setItem(KEY, JSON.stringify({ username, t: Date.now() }));
    return true;
  }
  return false;
}
export function logout(): void { localStorage.removeItem(KEY); }
export function isAuthed(): boolean { return localStorage.getItem(KEY) !== null; }
export function currentUser(): string | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as { username: string }).username;
}
