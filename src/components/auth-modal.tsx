"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "./auth-provider";

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, refresh } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!showAuthModal) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
    setSubmitting(false);
  };

  const close = () => {
    reset();
    setShowAuthModal(false);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const endpoint = tab === "register" ? "/api/auth/register" : "/api/auth/login";
    const body = tab === "register" ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      await refresh();
      close();
      // Redirect to complete-profile for new users
      if (tab === "register") {
        window.location.href = "/complete-profile";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = () => {
    setGoogleLoading(true);
    window.location.href = "/api/auth/google";
  };

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-2xl">
        <button
          onClick={close}
          className="absolute top-3 right-3 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-lg font-semibold text-stone-900">Welcome to OpenExperiments</h2>
        <p className="mb-5 text-sm text-stone-500">
          Sign in to submit hypotheses, comment, and vote.
        </p>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-md border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-60"
        >
          {googleLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
              Redirecting to Google...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs text-stone-400">or use email</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-md border border-stone-200 p-0.5">
          <button
            onClick={() => {
              setTab("login");
              setError("");
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === "login" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setTab("register");
              setError("");
            }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === "register" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {tab === "register" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="password"
            placeholder={tab === "register" ? "Create password (min 6 chars)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            minLength={tab === "register" ? 6 : undefined}
          />

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-stone-900 bg-stone-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {submitting ? "Please wait..." : tab === "register" ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
