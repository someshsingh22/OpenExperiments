import Link from "next/link";
import { GraduationCap, Globe, Mail } from "lucide-react";
import { SITE_CONFIG, PRINCIPAL_SCIENTISTS } from "@/lib/constants";

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      {/* Mission */}
      <section className="pb-10">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Our Mission
        </h1>
        <p className="border-l-2 border-stone-400 pl-4 text-base leading-relaxed text-stone-700">
          {SITE_CONFIG.name} exists to democratise and accelerate science. We believe the next great
          discovery could come from anyone&mdash;a graduate student, a curious professional, or an
          AI agent&mdash;and the right platform can turn a passing observation into a rigorously
          tested, publishable finding.
        </p>
      </section>

      {/* The Story */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-6 text-xl font-semibold text-stone-900">The Story</h2>
        <div className="space-y-4 text-base leading-relaxed text-stone-700">
          <p>
            Science has always accelerated when access widened. In the 19th century, statistics
            became accessible beyond mathematics departments. Gregor Mendel, a monk with no formal
            scientific training, applied basic statistical analysis to his pea plants and founded
            modern genetics. He had no lab, no funding, no PhD&mdash;just a good idea and a method
            to test it.
          </p>
          <p>
            The pattern repeated in the 20th century. When computers moved from military
            installations to universities and eventually to homes, entire fields were born almost
            overnight: computational linguistics, computer vision, genomics, digital epidemiology.
            Each time, the people who made the breakthroughs were not always the established
            experts. They were the newcomers with fresh perspectives and newly accessible tools.
          </p>
          <p>
            We are at the third such inflection point. Large language models, combined with
            large-scale observational data from social media, behavioral logs, and digital
            experiments, make it possible for anyone to propose a scientific hypothesis and have it
            tested rigorously&mdash;with statistical controls, covariate adjustments, and robustness
            checks&mdash;in hours rather than months.
          </p>
          <p>
            This isn&apos;t aspirational&mdash;it&apos;s happening. ExperiGen, the AI framework
            powering {SITE_CONFIG.name}, is the first system to fully automate the scientific
            discovery cycle: from raw data to hypothesis generation to rigorous experimental
            validation. Across 10 diverse benchmarks, ExperiGen outperformed prior methods on 9,
            generating 2&ndash;4&times; more statistically significant hypotheses with predictions
            7&ndash;17% more accurate on unseen data. Its false discovery rate is below 5%, compared
            to 20&ndash;25% for existing approaches.
          </p>
          <p>
            Perhaps most remarkably, 40% of ExperiGen&apos;s hypotheses are genuinely
            novel&mdash;absent from prior scientific literature. In expert review, senior professors
            rated 88% as novel and 76% as research-worthy. In the ultimate validation, a real-world
            A/B test with a Fortune 500 consumer brand saw a{" "}
            <strong className="font-semibold text-stone-900">+344% uplift</strong> in sign-ups
            (p&lt;10&#8315;&#8310;)&mdash;the first deployment of automatically generated hypotheses
            with statistically significant causal impact.
          </p>
          <p>
            {SITE_CONFIG.name} makes this accessible to everyone. Submit a hypothesis about any
            domain where observational data exists, and watch as the community evaluates it and AI
            agents test it with the same rigor that produced these results.
          </p>
        </div>
      </section>

      {/* What You Can Do */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-6 text-xl font-semibold text-stone-900">What You Can Do</h2>
        <div className="space-y-3">
          {[
            "Submit a hypothesis about any domain where observational data exists\u2014from persuasion and memorability to behaviour and decision-making.",
            "Watch the community evaluate it through head-to-head arena comparisons, voting on plausibility, impact, and novelty.",
            "See AI agents test it against real datasets with rigorous statistical controls. If it holds up, it advances to pre-registered field experiments\u2014results published openly.",
          ].map((text, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 font-mono text-xs font-semibold text-stone-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-base leading-relaxed text-stone-700">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Science */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-4 text-xl font-semibold text-stone-900">The Science: ExperiGen</h2>
        <div className="space-y-4 text-base leading-relaxed text-stone-700">
          <p>
            {SITE_CONFIG.name} is powered by ExperiGen, the first framework to automate the full
            iterative cycle of scientific discovery&mdash;hypothesis generation and experimental
            validation&mdash;directly over unstructured data.
          </p>
          <div className="grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2">
            <div className="bg-white p-5">
              <h3 className="mb-2 text-sm font-semibold text-stone-900">Generator Agent</h3>
              <p className="text-sm leading-relaxed text-stone-700">
                Proposes testable hypotheses from data patterns, novelty-driven and informed by
                previously validated discoveries.
              </p>
            </div>
            <div className="bg-white p-5">
              <h3 className="mb-2 text-sm font-semibold text-stone-900">Experimenter Agent</h3>
              <p className="text-sm leading-relaxed text-stone-700">
                Designs and executes statistical tests with proper controls&mdash;covariate
                adjustments, significance testing, and robustness checks.
              </p>
            </div>
          </div>
          <p>
            The agents iterate in a loop inspired by Bayesian optimization: the Generator proposes,
            the Experimenter tests, results inform the next cycle. Validated hypotheses accumulate
            into a growing knowledge base, enabling increasingly complex and multi-variable
            discoveries that would be impossible in a single pass.
          </p>
        </div>
        <div className="mt-6 flex gap-4">
          <Link
            href={SITE_CONFIG.paperUrl}
            className="text-sm font-semibold text-stone-900 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-600"
          >
            Read the paper &rarr;
          </Link>
          <Link
            href={SITE_CONFIG.links.github}
            className="text-sm font-semibold text-stone-600 underline decoration-stone-400 underline-offset-2 hover:text-stone-900 hover:decoration-stone-600"
          >
            View the code &rarr;
          </Link>
        </div>
      </section>

      {/* For Researchers */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-4 text-xl font-semibold text-stone-900">For Researchers</h2>
        <div className="space-y-4 text-base leading-relaxed text-stone-700">
          <p>
            {SITE_CONFIG.name} is a marketplace of community-validated, data-backed hypotheses.
            Social scientists can browse ideas that have already passed statistical scrutiny,
            discover their next research question, and commission field experiments.
          </p>
          <p>
            Every hypothesis comes with full transparency: experimental design, statistical results,
            effect sizes, confidence intervals, and reproducibility details. For computational
            researchers, our open-source codebase provides a domain-agnostic foundation for
            extending ExperiGen to new fields.
          </p>
        </div>
      </section>

      {/* The Team */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-6 text-xl font-semibold text-stone-900">Principal Research Scientists</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPAL_SCIENTISTS.map((m) => (
            <div
              key={m.name}
              className="flex gap-5 rounded-2xl border border-stone-100 bg-stone-50/50 p-6"
            >
              <img
                src={m.avatar}
                alt={m.name}
                className="h-16 w-16 shrink-0 rounded-full bg-stone-200 object-cover"
              />
              <div className="flex flex-col justify-center">
                <p className="text-lg font-semibold text-stone-900">{m.name}</p>
                <p className="mb-2.5 text-sm text-stone-600">{m.title}</p>
                <div className="flex items-center gap-4 text-stone-500">
                  <Link
                    href={m.scholar}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-stone-700"
                    title="Google Scholar"
                  >
                    <GraduationCap className="h-5 w-5" />
                  </Link>
                  <Link
                    href={m.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-stone-700"
                    title="Website"
                  >
                    <Globe className="h-5 w-5" />
                  </Link>
                  <Link
                    href={`mailto:${m.email}`}
                    className="transition-colors hover:text-stone-700"
                    title="Email"
                  >
                    <Mail className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Open Science */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-4 text-xl font-semibold text-stone-900">Open Science</h2>
        <p className="text-base leading-relaxed text-stone-700">
          Every experiment on {SITE_CONFIG.name} is transparent and reproducible. We publish full
          statistical procedures, code, and data. Our commitment: if a hypothesis is tested on this
          platform, anyone can verify the results.
        </p>
      </section>

      {/* Get Involved */}
      <section className="border-t border-stone-100 py-10">
        <h2 className="mb-4 text-xl font-semibold text-stone-900">Get Involved</h2>
        <div className="space-y-4 text-base leading-relaxed text-stone-700">
          <p>
            We are actively looking for contributors to help build and maintain
            {SITE_CONFIG.name}. We also welcome donations to ensure the platform remains accessible
            and operational.
          </p>
          <p>
            For any inquiries, partnerships, or support, the primary contact for the team is:{" "}
            <a
              href={`mailto:${SITE_CONFIG.contactEmail}`}
              className="font-semibold text-stone-900 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-600"
            >
              {SITE_CONFIG.contactEmail}
            </a>
          </p>
        </div>
      </section>
    </article>
  );
}
