"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, X, LogOut, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { useAuth } from "./auth-provider";

const navLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/data", label: "Data" },
  { href: "/arena", label: "Arena" },
  { href: "/experiments", label: "Experiments" },
  { href: "/contribute", label: "Contribute" },
  { href: "/about", label: "About" },
];

const SUBMIT_MENU_ID = "navbar-submit-menu";
const USER_MENU_ID = "navbar-user-menu";
const MOBILE_MENU_ID = "navbar-mobile-menu";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const submitHoverRef = useRef(false);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const { user, loading, signOut, setShowAuthModal } = useAuth();

  useEffect(() => {
    if (!userMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!submitOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (submitRef.current && !submitRef.current.contains(e.target as Node)) {
        setSubmitOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [submitOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const closeSubmitOnBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSubmitOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="" width={32} height={24} className="h-6 w-8" />
          <span className="text-base font-semibold tracking-tight text-stone-900">
            OpenExperiments
          </span>
          <span className="hidden text-xs font-medium tracking-[0.15em] text-stone-600 uppercase sm:block">
            Democratising Science
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              className={clsx(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                isActivePath(pathname, link.href)
                  ? "bg-stone-100 text-stone-900"
                  : "text-stone-600 hover:text-stone-800",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div
            ref={submitRef}
            className="relative ml-2 flex items-center"
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              submitHoverRef.current = true;
              setSubmitOpen(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "mouse") return;
              submitHoverRef.current = false;
              setSubmitOpen(false);
            }}
            onBlur={closeSubmitOnBlur}
            onKeyDown={(e) => {
              if (e.key === "Escape" && submitOpen) {
                e.stopPropagation();
                setSubmitOpen(false);
                submitButtonRef.current?.focus();
              }
            }}
          >
            <button
              ref={submitButtonRef}
              type="button"
              aria-expanded={submitOpen}
              aria-controls={SUBMIT_MENU_ID}
              onClick={() => {
                // A mouse click while hovering keeps the hover-opened menu open.
                if (submitHoverRef.current && submitOpen) return;
                setSubmitOpen(!submitOpen);
              }}
              className="flex items-center gap-1.5 rounded-md border border-stone-900 bg-stone-900 px-4 py-1.5 text-[13px] font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-stone-800"
            >
              Submit
              <ChevronDown
                className={clsx("h-3.5 w-3.5 transition-transform", submitOpen && "rotate-180")}
              />
            </button>
            {submitOpen && (
              <div id={SUBMIT_MENU_ID} className="absolute top-full right-0 w-48 pt-2">
                <div className="animate-in fade-in slide-in-from-top-2 z-50 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl transition-all">
                  <Link
                    href="/submit"
                    className="block rounded-lg px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 hover:text-stone-900"
                    onClick={() => setSubmitOpen(false)}
                  >
                    Submit a Hypothesis
                  </Link>
                  <Link
                    href="/experiments#submit"
                    className="block rounded-lg px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 hover:text-stone-900"
                    onClick={() => setSubmitOpen(false)}
                  >
                    Submit an Experiment
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Auth */}
          <div className="ml-2 grid shrink-0 items-center justify-items-end" ref={userMenuRef}>
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 rounded-md border border-transparent px-3 py-1.5 text-[13px] font-medium"
            >
              Sign In
            </span>
            {!loading &&
              (user ? (
                <div
                  className="relative col-start-1 row-start-1"
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && userMenuOpen) {
                      e.stopPropagation();
                      setUserMenuOpen(false);
                      userMenuButtonRef.current?.focus();
                    }
                  }}
                >
                  <button
                    ref={userMenuButtonRef}
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-label={`Account menu for ${user.name || "your account"}`}
                    aria-expanded={userMenuOpen}
                    aria-controls={USER_MENU_ID}
                    className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-stone-100"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="h-7 w-7 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
                        {(user.name || "U")[0]}
                      </div>
                    )}
                  </button>
                  {userMenuOpen && (
                    <div
                      id={USER_MENU_ID}
                      className="absolute top-full right-0 z-50 mt-2 w-52 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl"
                    >
                      <div className="mb-1 border-b border-stone-100 px-3 py-2">
                        <p className="truncate text-sm font-medium text-stone-800">{user.name}</p>
                        <p className="truncate text-xs text-stone-600">{user.email}</p>
                      </div>
                      <Link
                        href={`/profile/${user.id}`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                      >
                        <User className="h-3.5 w-3.5" />
                        My Profile
                      </Link>
                      <button
                        onClick={async () => {
                          setUserMenuOpen(false);
                          await signOut();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="col-start-1 row-start-1 rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
                >
                  Sign In
                </button>
              ))}
          </div>
        </div>

        <button
          ref={mobileButtonRef}
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls={MOBILE_MENU_ID}
          className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          id={MOBILE_MENU_ID}
          className="border-t border-stone-100 bg-white px-4 pt-2 pb-4 md:hidden"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              className={clsx(
                "flex min-h-11 items-center rounded-md px-3 text-sm font-medium",
                isActivePath(pathname, link.href)
                  ? "bg-stone-100 text-stone-900"
                  : "text-stone-600",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-stone-600 uppercase">
              Submit
            </p>
            <Link
              href="/submit"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900"
            >
              Submit a Hypothesis
            </Link>
            <Link
              href="/experiments#submit"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900"
            >
              Submit an Experiment
            </Link>
          </div>
          {/* Mobile auth */}
          <div className="mt-4 border-t border-stone-100 pt-4">
            {!loading &&
              (user ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
                        {(user.name || "U")[0]}
                      </div>
                    )}
                    <span className="text-sm font-medium text-stone-800">{user.name}</span>
                  </div>
                  <Link
                    href={`/profile/${user.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-stone-600"
                  >
                    My Profile
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileOpen(false);
                      await signOut();
                    }}
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-stone-600"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setShowAuthModal(true);
                  }}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-stone-700"
                >
                  Sign In
                </button>
              ))}
          </div>
        </div>
      )}
    </nav>
  );
}
