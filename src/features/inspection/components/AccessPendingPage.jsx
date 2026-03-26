export default function AccessPendingPage({ onSignOut }) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-header__eyebrow">
            <span className="dashboard-role-pill">Access pending</span>
          </div>
          <h1>Account not provisioned</h1>
          <p>Your Firebase login is valid, but this account has not been added to the current organization yet.</p>
          <p className="dashboard-role-note">
            Ask an all-access user to create your Firestore user document or reseed this org with your real Firebase
            Auth UID and email.
          </p>
        </div>
        <div className="dashboard-header__actions">
          <button type="button" className="btn ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
