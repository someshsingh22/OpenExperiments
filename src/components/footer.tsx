import Link from "next/link";
import Image from "next/image";
import { SITE_CONFIG } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt={SITE_CONFIG.name}
                width={24}
                height={24}
                className="h-6 w-auto"
              />
              <span className="text-lg font-semibold tracking-tight text-stone-900">
                {SITE_CONFIG.name}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-stone-500">
              {SITE_CONFIG.description}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Navigation</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <Link
                      href="/about"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      About
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/explore"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Explore
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/arena"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Arena
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-stone-900">Contributing</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <Link
                      href="/contribute"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Contribute
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/experiments"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Experiments
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/submit"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Submit Hypothesis
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Research</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <Link
                      href={SITE_CONFIG.paperUrl}
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Original Paper
                    </Link>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.links.labUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Lab / Research Group
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      GitHub Repository
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-stone-900">Contact</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <a
                      href={`mailto:${SITE_CONFIG.contactEmail}`}
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      {SITE_CONFIG.contactEmail}
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-stone-500 transition-colors hover:text-stone-900"
                    >
                      Twitter / X
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-stone-200 pt-8">
          <p className="text-xs text-stone-400">
            &copy; {new Date().getFullYear()} {SITE_CONFIG.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
