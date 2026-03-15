"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ArrowRight } from "lucide-react";

export default function CompleteProfilePage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [scholarUrl, setScholarUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [orcid, setOrcid] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
    if (user) {
      setName(user.name || "");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          position: position.trim(),
          scholarUrl: scholarUrl.trim(),
          website: website.trim(),
          bio: bio.trim(),
          orcid: orcid.trim(),
          twitterHandle: twitterHandle.trim(),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as {
          error?: string;
          errors?: { field: string; message: string }[];
        };
        if (data.errors?.length) {
          setError(data.errors.map((e) => e.message).join(". "));
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }

      await refresh();
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 transition-colors focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Complete your profile
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Tell us a bit about yourself so the community knows who you are.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className={inputClass}
            required
          />
          <p className="mt-1 text-xs text-stone-400">Displayed on your comments and hypotheses.</p>
        </div>

        {/* Contact email — shown but read-only */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">Contact email</label>
          <input
            type="email"
            value={user.email || ""}
            readOnly
            className={`${inputClass} bg-stone-50 text-stone-500`}
          />
          <p className="mt-1 text-xs text-stone-400">
            From your sign-in. Your affiliation is derived from your email domain.
          </p>
        </div>

        {/* Position */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">Position</label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g., Research Scientist, Engineer, PhD Student, Professor"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-stone-400">
            Your role or title. This helps the community understand your background.
          </p>
        </div>

        {/* Google Scholar */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">
            Google Scholar profile
          </label>
          <input
            type="url"
            value={scholarUrl}
            onChange={(e) => setScholarUrl(e.target.value)}
            placeholder="https://scholar.google.com/citations?user=..."
            className={inputClass}
          />
        </div>

        {/* Website */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">
            Personal website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourwebsite.com"
            className={inputClass}
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio about yourself and your research interests"
            rows={3}
            className={inputClass}
            maxLength={500}
          />
          <p className="mt-1 text-right text-[11px] text-stone-400">{bio.length}/500</p>
        </div>

        {/* ORCID */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">ORCID</label>
          <input
            type="text"
            value={orcid}
            onChange={(e) => setOrcid(e.target.value)}
            placeholder="0000-0002-1825-0097"
            className={inputClass}
          />
        </div>

        {/* Twitter / X */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">
            X / Twitter handle
          </label>
          <input
            type="text"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            placeholder="@handle"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save & Continue"}
            {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm text-stone-400 hover:text-stone-600"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}
