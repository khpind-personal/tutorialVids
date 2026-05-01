import { Link } from "react-router-dom";
import { currentUser, logout } from "../auth";
export default function Dashboard() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>
      <p>Welcome, {currentUser()}.</p>
      <ul><li><Link data-test="link-profile" to="/profile">Profile</Link></li></ul>
      <button data-test="logout" onClick={logout}>Sign out</button>
    </main>
  );
}
