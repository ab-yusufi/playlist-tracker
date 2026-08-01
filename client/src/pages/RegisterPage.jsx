import { useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

    if (form.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (form.password.length > 72) {
      setErrorMessage("Password must not exceed 72 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        email: normalizedEmail,
        password: form.password,
      });

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        error.message || "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start tracking your learning playlists."
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerLinkTo="/login"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {errorMessage && (
          <div className="form-error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="register-email">Email</label>

          <input
            id="register-email"
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
          <label htmlFor="register-password">Password</label>

          <input
            id="register-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            maxLength={72}
            required
          />

          <small>Use between 8 and 72 characters.</small>
        </div>

        <div className="form-field">
          <label htmlFor="confirm-password">Confirm password</label>

          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            placeholder="Enter the password again"
            minLength={8}
            maxLength={72}
            required
          />
        </div>

        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
