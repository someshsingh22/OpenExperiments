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
              <Image src="/logo.svg" alt={SITE_CONFIG.name} width={24} height={24} className="h-6 w-auto" />
              <span className="text-lg font-semibold tracking-tight text-stone-900">
                {SITE_CONFIG.name}
              </span>
            </Link>
            <p className="text-sm text-stone-500 leading-relaxed max-w-xs">
              {SITE_CONFIG.description}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Navigation</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <Link href="/about" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/explore" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Explore
                    </Link>
                  </li>
                  <li>
                    <Link href="/arena" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Arena
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-stone-900">Contributing</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <Link href="/contribute" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Contribute
                    </Link>
                  </li>
                  <li>
                    <Link href="/experiments" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Experiments
                    </Link>
                  </li>
                  <li>
                    <Link href="/submit" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
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
                    <Link href={SITE_CONFIG.paperUrl} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Original Paper
                    </Link>
                  </li>
                  <li>
                    <a href={SITE_CONFIG.links.labUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Lab / Research Group
                    </a>
                  </li>
                  <li>
                    <a href={SITE_CONFIG.links.github} target="_blank" rel="noopener noreferrer" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      GitHub Repository
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-stone-900">Contact</h3>
                <ul role="list" className="mt-4 space-y-3">
                  <li>
                    <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      {SITE_CONFIG.contactEmail}
                    </a>
                  </li>
                  <li>
                    <a href={SITE_CONFIG.links.twitter} target="_blank" rel="noopener noreferrer" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                      Twitter / X
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-stone-200 pt-8 flex items-center justify-between">
          <p className="text-xs text-stone-400">
            &copy; {new Date().getFullYear()} {SITE_CONFIG.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
