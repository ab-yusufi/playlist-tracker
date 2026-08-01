import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

function getRedirectPath(location) {
  const requestedPath = location.state?.from;

  if (
    typeof requestedPath === "string" &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//")
  ) {
    return requestedPath;
  }

  return "/";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");

    const normalizedEmail = form.email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (!form.password) {
      setErrorMessage("Enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: normalizedEmail,
        password: form.password,
      });

      navigate(getRedirectPath(location), {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(error.message || "Unable to log in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to continue your playlists."
      footerText="Don't have an account?"
      footerLinkText="Create one"
      footerLinkTo="/register"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {errorMessage && (
          <div className="form-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="login-email">Email</label>

          <input
            id="login-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={254}
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <div className="field-label-row">
            <label htmlFor="login-password">Password</label>

            <span
              className="muted-link disabled-link"
              title="Password reset will be added later"
            >
              Forgot password?
            </span>
          </div>

          <input
            id="login-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            placeholder="Enter your password"
            maxLength={72}
            required
          />
        </div>

        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
