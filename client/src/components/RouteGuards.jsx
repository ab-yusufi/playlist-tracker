import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";

export function FullPageLoader() {
  return (
    <main className="page-center">
      <div className="loader-card" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading your account…</p>
      </div>
    </main>
  );
}

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
