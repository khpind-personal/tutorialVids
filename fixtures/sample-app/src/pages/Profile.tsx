import { Link } from "react-router-dom";
import { currentUser } from "../auth";
export default function Profile() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Profile</h1>
      <p>Username: {currentUser()}</p>
      <Link data-test="link-dashboard" to="/dashboard">Back to dashboard</Link>
    </main>
  );
}
