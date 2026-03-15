"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, X, LogOut, User } from "lucide-react";
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

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut, setShowAuthModal } = useAuth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="OpenExperiments"
            width={24}
            height={24}
            className="h-6 w-auto"
          />
          <span className="text-base font-semibold tracking-tight text-stone-900">
            OpenExperiments
          </span>
          <span className="hidden text-[10px] font-medium tracking-[0.15em] text-stone-400 uppercase sm:block">
            Democratising Science
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "bg-stone-100 text-stone-900"
                  : "text-stone-500 hover:text-stone-800",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="relative ml-2 flex items-center"
            onMouseEnter={() => setSubmitOpen(true)}
            onMouseLeave={() => setSubmitOpen(false)}
          >
            <button className="flex items-center gap-1.5 rounded-md border border-stone-900 bg-stone-900 px-4 py-1.5 text-[13px] font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-stone-800">
              Submit
            </button>
            {submitOpen && (
              <div className="absolute top-full right-0 w-48 pt-2">
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
          {!loading && (
            <div className="ml-2" ref={userMenuRef}>
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-stone-100"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
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
                    <div className="absolute top-full right-0 z-50 mt-2 w-52 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl">
                      <div className="mb-1 border-b border-stone-100 px-3 py-2">
                        <p className="truncate text-sm font-medium text-stone-800">{user.name}</p>
                        <p className="truncate text-xs text-stone-400">{user.email}</p>
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
                  onClick={() => setShowAuthModal(true)}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
                >
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-stone-100 bg-white px-4 pt-2 pb-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm font-medium",
                pathname === link.href ? "bg-stone-100 text-stone-900" : "text-stone-500",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-stone-400 uppercase">
              Submit
            </p>
            <Link
              href="/submit"
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900"
            >
              Submit a Hypothesis
            </Link>
            <Link
              href="/experiments#submit"
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900"
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
                    className="block rounded-md px-3 py-2 text-sm font-medium text-stone-500"
                  >
                    My Profile
                  </Link>
                  <button
                    onClick={async () => {
                      setMobileOpen(false);
                      await signOut();
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-stone-500"
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
                  className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-stone-700"
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
