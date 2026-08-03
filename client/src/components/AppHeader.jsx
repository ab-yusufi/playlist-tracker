import { useState } from "react";
import { Link } from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";

import ThemeToggle from "./ThemeToggle.jsx";

export default function AppHeader() {
  const { user, logout } = useAuth();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setErrorMessage("");
    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      setErrorMessage(error.message || "Unable to log out. Please try again.");

      setIsLoggingOut(false);
    }
  }

  return (
    <header className="app-header">
      <Link className="brand" to="/">
        Playlist Tracker
      </Link>

      <div className="header-account">
        <ThemeToggle />
        {errorMessage && (
          <span className="header-error" role="alert" title={errorMessage}>
            Logout failed
          </span>
        )}

        <span className="account-email" title={user?.email}>
          {user?.email}
        </span>

        <button
          className="secondary-button header-button"
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
