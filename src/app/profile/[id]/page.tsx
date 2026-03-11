"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, MessageSquare, FlaskConical, Building2, GraduationCap, Globe, ExternalLink, EyeOff } from "lucide-react";
import { EvidenceBadge } from "@/components/evidence-badge";
import { DomainTag } from "@/components/domain-tag";
import type { Domain, HypothesisStatus, Phase } from "@/lib/types";

interface ProfileData {
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    affiliation: string | null;
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
  stats: {
    hypothesisCount: number;
    commentCount: number;
  };
  isOwner: boolean;
}

export default function ProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not found");
        const json = await res.json() as { data: ProfileData };
        setData(json.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

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

  const { user, hypotheses, stats, isOwner } = data;

  const hasLinks = user.scholarUrl || user.website || user.orcid || user.twitterHandle;

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
          <h1 className="text-xl font-semibold text-stone-900">
            {user.name || "Anonymous"}
          </h1>
          {user.affiliation && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-500">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {user.affiliation}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm text-stone-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {user.joinedAt}
            </span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="mb-6 text-sm leading-relaxed text-stone-600">{user.bio}</p>
      )}

      {/* Links */}
      {hasLinks && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {user.scholarUrl && (
            <a href={user.scholarUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800">
              <GraduationCap className="h-3.5 w-3.5" /> Scholar
            </a>
          )}
          {user.website && (
            <a href={user.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800">
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
          {user.orcid && (
            <a href={`https://orcid.org/${user.orcid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800">
              <ExternalLink className="h-3.5 w-3.5" /> ORCID
            </a>
          )}
          {user.twitterHandle && (
            <a href={`https://x.com/${user.twitterHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800">
              <ExternalLink className="h-3.5 w-3.5" /> @{user.twitterHandle.replace(/^@/, "")}
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold text-stone-800">{stats.hypothesisCount}</p>
          <p className="text-xs text-stone-400">
            <FlaskConical className="mr-1 inline h-3 w-3" />
            Hypotheses
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-center">
          <p className="text-2xl font-semibold text-stone-800">{stats.commentCount}</p>
          <p className="text-xs text-stone-400">
            <MessageSquare className="mr-1 inline h-3 w-3" />
            Comments
          </p>
        </div>
      </div>

      {/* Hypotheses */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-500">
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
                <p className="text-[13px] leading-relaxed text-stone-700">
                  {h.statement}
                </p>
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
