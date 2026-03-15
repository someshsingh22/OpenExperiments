"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  MessageSquare,
  FlaskConical,
  Briefcase,
  GraduationCap,
  Globe,
  ExternalLink,
  EyeOff,
  Star,
  Pencil,
  X,
  Check,
  Lightbulb,
  Vote,
} from "lucide-react";
import { EvidenceBadge } from "@/components/evidence-badge";
import { DomainTag } from "@/components/domain-tag";
import { updateProfile } from "@/lib/api";
import type { Domain, HypothesisStatus, Phase } from "@/lib/types";

interface ProfileData {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    affiliation: string | null;
    position: string | null;
    scholarUrl: string | null;
    website: string | null;
    bio: string | null;
    orcid: string | null;
    twitterHandle: string | null;
    joinedAt: string;
  };
  hypotheses: {
    id: string;
    statement: string;
    status: HypothesisStatus;
    phase: Phase;
    domain: string[];
    isAnonymous: boolean;
    submittedAt: string;
  }[];
  starredHypotheses: {
    id: string;
    statement: string;
    status: HypothesisStatus;
    phase: Phase;
    domain: string[];
    submittedAt: string;
  }[];
  stats: {
    hypothesisCount: number;
    experimentCount: number;
    commentCount: number;
    voteCount: number;
  };
  isOwner: boolean;
}

export default function ProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editScholarUrl, setEditScholarUrl] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editOrcid, setEditOrcid] = useState("");
  const [editTwitter, setEditTwitter] = useState("");

  const loadProfile = useCallback(() => {
    fetch(`/api/users/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not found");
        const json = (await res.json()) as { data: ProfileData };
        setData(json.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const startEditing = () => {
    if (!data) return;
    setEditName(data.user.name || "");
    setEditPosition(data.user.position || "");
    setEditScholarUrl(data.user.scholarUrl || "");
    setEditWebsite(data.user.website || "");
    setEditBio(data.user.bio || "");
    setEditOrcid(data.user.orcid || "");
    setEditTwitter(data.user.twitterHandle || "");
    setEditError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditError("");
  };

  const saveProfile = async () => {
    if (!data) return;
    setSaving(true);
    setEditError("");
    try {
      await updateProfile(id, {
        name: editName,
        position: editPosition,
        scholarUrl: editScholarUrl,
        website: editWebsite,
        bio: editBio,
        orcid: editOrcid,
        twitterHandle: editTwitter,
      });
      setEditing(false);
      // Reload profile data
      setLoading(true);
      loadProfile();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-1 text-lg font-semibold text-stone-800">User not found</h1>
        <p className="text-sm text-stone-400">This profile does not exist.</p>
      </div>
    );
  }

  const { user, hypotheses, starredHypotheses, stats, isOwner } = data;

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Profile header */}
      <div className="mb-6 flex items-start gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-200 text-xl font-semibold text-stone-500">
            {(user.name || "U")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-stone-900">{user.name || "Anonymous"}</h1>
            {isOwner && !editing && (
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>
          {user.position && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-500">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              {user.position}
            </p>
          )}
          {user.affiliation && <p className="mt-0.5 text-xs text-stone-400">{user.affiliation}</p>}
          <div className="mt-1 flex items-center gap-3 text-sm text-stone-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {user.joinedAt}
            </span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mb-8 space-y-4 rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">Edit Profile</h2>
            <button onClick={cancelEditing} className="text-stone-400 hover:text-stone-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Position</label>
            <input
              type="text"
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              placeholder="e.g., Research Scientist, Engineer, PhD Student"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              Google Scholar Profile
            </label>
            <input
              type="url"
              value={editScholarUrl}
              onChange={(e) => setEditScholarUrl(e.target.value)}
              placeholder="https://scholar.google.com/citations?user=..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              Personal Website
            </label>
            <input
              type="url"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="A short bio about yourself"
              rows={3}
              className={inputClass}
              maxLength={500}
            />
            <p className="mt-1 text-right text-[11px] text-stone-400">{editBio.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">ORCID</label>
            <input
              type="text"
              value={editOrcid}
              onChange={(e) => setEditOrcid(e.target.value)}
              placeholder="0000-0002-1825-0097"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">
              X / Twitter Handle
            </label>
            <input
              type="text"
              value={editTwitter}
              onChange={(e) => setEditTwitter(e.target.value)}
              placeholder="@handle"
              className={inputClass}
            />
          </div>

          {editError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {editError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={cancelEditing}
              className="rounded-md border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bio */}
      {!editing && (
        <div className="mb-6">
          {user.bio ? (
            <p className="text-sm leading-relaxed text-stone-600">{user.bio}</p>
          ) : isOwner ? (
            <p className="text-sm text-stone-300 italic">No bio set. Click Edit to add one.</p>
          ) : null}
        </div>
      )}

      {/* Links */}
      {!editing && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {user.scholarUrl ? (
            <a
              href={user.scholarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <GraduationCap className="h-3.5 w-3.5" /> Scholar
            </a>
          ) : isOwner ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-300">
              <GraduationCap className="h-3.5 w-3.5" /> Not set
            </span>
          ) : null}
          {user.website ? (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          ) : isOwner ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-300">
              <Globe className="h-3.5 w-3.5" /> Not set
            </span>
          ) : null}
          {user.orcid ? (
            <a
              href={`https://orcid.org/${user.orcid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <ExternalLink className="h-3.5 w-3.5" /> ORCID
            </a>
          ) : isOwner ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-300">
              <ExternalLink className="h-3.5 w-3.5" /> ORCID not set
            </span>
          ) : null}
          {user.twitterHandle ? (
            <a
              href={`https://x.com/${user.twitterHandle.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <ExternalLink className="h-3.5 w-3.5" /> @{user.twitterHandle.replace(/^@/, "")}
            </a>
          ) : isOwner ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-300">
              <ExternalLink className="h-3.5 w-3.5" /> X not set
            </span>
          ) : null}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 bg-white p-4 text-center">
            <p className="text-2xl font-semibold text-stone-800">{stats.hypothesisCount}</p>
            <p className="text-xs text-stone-400">
              <Lightbulb className="mr-1 inline h-3 w-3" />
              Hypotheses
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4 text-center">
            <p className="text-2xl font-semibold text-stone-800">{stats.experimentCount}</p>
            <p className="text-xs text-stone-400">
              <FlaskConical className="mr-1 inline h-3 w-3" />
              Experiments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[13px] text-stone-400">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {stats.commentCount} comments
          </span>
          <span className="flex items-center gap-1">
            <Vote className="h-3 w-3" />
            {stats.voteCount} votes
          </span>
        </div>
      </div>

      {/* Starred Hypotheses */}
      {starredHypotheses.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-stone-500 uppercase">
            <Star className="mr-1 inline h-3.5 w-3.5" />
            Starred Hypotheses
          </h2>
          <div className="space-y-3">
            {starredHypotheses.map((h) => (
              <Link
                key={h.id}
                href={`/hypothesis/${h.id}`}
                className="block rounded-lg border border-stone-200 bg-white p-4 transition-all hover:border-stone-300 hover:shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <EvidenceBadge status={h.status} phase={h.phase} size="sm" />
                  {h.domain.map((d) => (
                    <DomainTag key={d} domain={d as Domain} />
                  ))}
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </div>
                <p className="text-[13px] leading-relaxed text-stone-700">{h.statement}</p>
                <p className="mt-1.5 text-[11px] text-stone-400">{h.submittedAt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hypotheses */}
      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wider text-stone-500 uppercase">
          Hypotheses
        </h2>
        {hypotheses.length > 0 ? (
          <div className="space-y-3">
            {hypotheses.map((h) => (
              <Link
                key={h.id}
                href={`/hypothesis/${h.id}`}
                className="block rounded-lg border border-stone-200 bg-white p-4 transition-all hover:border-stone-300 hover:shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <EvidenceBadge status={h.status} phase={h.phase} size="sm" />
                  {h.domain.map((d) => (
                    <DomainTag key={d} domain={d as Domain} />
                  ))}
                  {h.isAnonymous && isOwner && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                      <EyeOff className="h-3 w-3" /> Private
                    </span>
                  )}
                </div>
                <p className="text-[13px] leading-relaxed text-stone-700">{h.statement}</p>
                <p className="mt-1.5 text-[11px] text-stone-400">{h.submittedAt}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-400">No hypotheses submitted yet.</p>
        )}
      </section>
    </div>
  );
}
