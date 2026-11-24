import Link from "next/link";
import Image from "next/image";
import { SITE_CONFIG } from "@/lib/constants";

const footerLink =
  "inline-flex min-h-11 items-center text-sm text-stone-600 transition-colors hover:text-stone-900 md:min-h-0";

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="" width={32} height={24} className="h-6 w-8" />
              <span className="text-lg font-semibold tracking-tight text-stone-900">
                {SITE_CONFIG.name}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-stone-600">
              {SITE_CONFIG.description}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-8 xl:col-span-2 xl:mt-0">
            <div className="min-w-0 md:grid md:grid-cols-2 md:gap-8">
              <div>
                <p className="text-sm font-semibold text-stone-900">Navigation</p>
                <ul role="list" className="mt-2 md:mt-4 md:space-y-3">
                  <li>
                    <Link href="/about" className={footerLink}>
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/explore" className={footerLink}>
                      Explore
                    </Link>
                  </li>
                  <li>
                    <Link href="/arena" className={footerLink}>
                      Arena
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <p className="text-sm font-semibold text-stone-900">Contributing</p>
                <ul role="list" className="mt-2 md:mt-4 md:space-y-3">
                  <li>
                    <Link href="/contribute" className={footerLink}>
                      Contribute
                    </Link>
                  </li>
                  <li>
                    <Link href="/experiments" className={footerLink}>
                      Experiments
                    </Link>
                  </li>
                  <li>
                    <Link href="/submit" className={footerLink}>
                      Submit Hypothesis
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="min-w-0 md:grid md:grid-cols-2 md:gap-8">
              <div>
                <p className="text-sm font-semibold text-stone-900">Research</p>
                <ul role="list" className="mt-2 md:mt-4 md:space-y-3">
                  <li>
                    <Link href={SITE_CONFIG.paperUrl} className={footerLink}>
                      Original Paper
                    </Link>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.links.labUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={footerLink}
                    >
                      Lab / Research Group
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={footerLink}
                    >
                      GitHub Repository
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <p className="text-sm font-semibold text-stone-900">Contact</p>
                <ul role="list" className="mt-2 md:mt-4 md:space-y-3">
                  <li>
                    <a
                      href={`mailto:${SITE_CONFIG.contactEmail}`}
                      className={`${footerLink} wrap-anywhere`}
                    >
                      {SITE_CONFIG.contactEmail}
                    </a>
                  </li>
                  <li>
                    <a
                      href={SITE_CONFIG.links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={footerLink}
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
          <p className="text-xs text-stone-600">
            &copy; {new Date().getFullYear()} {SITE_CONFIG.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
