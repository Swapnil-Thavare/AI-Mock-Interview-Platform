import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#report', label: 'Reports' },
];

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`flex items-center gap-2 ${className}`}>
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm">
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <path d="M12 19v3" />
      </svg>
    </span>
    <span className="text-xl font-bold tracking-tight text-gray-900">
      Intelli<span className="text-primary-700">Interview</span>
    </span>
  </span>
);

const FeatureIcon: React.FC<{ path: React.ReactNode }> = ({ path }) => (
  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/70 text-primary-600 shadow-sm ring-1 ring-primary-100 transition-all duration-300 group-hover:from-primary-100 group-hover:to-primary-50 group-hover:text-primary-700 group-hover:shadow">
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  </span>
);

const FEATURES: { title: string; description: string; icon: React.ReactNode }[] = [
  {
    title: 'AI mock interviews',
    description:
      'Practice realistic interviews generated from your resume and target job description — in text, audio, or video mode.',
    icon: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        <path d="M8 8h8" />
        <path d="M8 11h5" />
      </>
    ),
  },
  {
    title: 'Resume analysis',
    description:
      'Upload a PDF resume and get your skills, strengths, frameworks, and improvement areas extracted automatically.',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </>
    ),
  },
  {
    title: 'Resume–job matching',
    description:
      'See your compatibility score against any job description, with matched skills, gaps, and recommendations.',
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
        <path d="m8.5 11 1.8 1.8 3.2-3.6" />
      </>
    ),
  },
  {
    title: 'Per-answer evaluation',
    description:
      'Every answer is scored on relevance, correctness, clarity, and depth, with strengths and missing points called out.',
    icon: (
      <>
        <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: 'Communication analysis',
    description:
      'Spoken answers are transcribed and analyzed for pace, fillers, and pauses — plus session integrity observations.',
    icon: (
      <>
        <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
        <path d="M12 18v4" />
      </>
    ),
  },
  {
    title: 'Assessment reports',
    description:
      'Get a printable interview report with question-wise analysis, scores, and preparation recommendations.',
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 15 4-5 4 3 5-7" />
      </>
    ),
  },
];

const STEPS = [
  {
    title: 'Set up your interview',
    description:
      'Upload your resume, add a job description, then pick a mode, difficulty, and question count.',
  },
  {
    title: 'Complete the interview',
    description:
      'Answer AI-generated questions by typing or speaking, with an optional device check for voice modes.',
  },
  {
    title: 'Get evaluated instantly',
    description:
      'Each answer is scored and critiqued as you go — spoken answers are transcribed automatically.',
  },
  {
    title: 'Review your report',
    description:
      'Open a full assessment report with scores, communication analysis, and what to prepare next.',
  },
];

/** Decorative mock product UI for the hero — built from styled markup, not imagery. */
const HeroMockup: React.FC = () => (
  <div className="relative mx-auto w-full max-w-lg">
    {/* Glow */}
    <div
      aria-hidden="true"
      className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-primary-200/60 via-primary-100/40 to-transparent blur-2xl"
    />

    {/* Main interview card — framed like an app window */}
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-2xl shadow-primary-900/10 backdrop-blur">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] text-gray-500 ring-1 ring-gray-200">
          <svg
            className="h-3 w-3 text-green-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          intelliinterview.app/interview
        </span>
      </div>
      <div className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Mock interview</span>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-800">
            Video
          </span>
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse-soft" />
            Recording
          </span>
        </div>
        <span className="rounded-lg bg-primary-100 px-2 py-1 text-xs font-medium text-primary-800">
          01:47
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full rounded-full bg-gray-100">
        <div className="h-1.5 w-3/5 rounded-full bg-primary-600" />
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs text-gray-500">Question 3 of 5</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">
          Walk me through how you would design a rate limiter for a public API.
        </p>
      </div>

      <div className="mt-3 space-y-2 rounded-xl border border-gray-200 p-3">
        <div className="h-2 w-11/12 rounded bg-gray-100" />
        <div className="h-2 w-4/5 rounded bg-gray-100" />
        <div className="h-2 w-3/5 rounded bg-gray-100" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">
          Submit &amp; next
        </span>
        <span className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
          Skip
        </span>
      </div>
      </div>
    </div>

    {/* Floating score card */}
    <div className="absolute -right-4 -top-8 hidden w-40 rounded-xl border border-gray-200 bg-white p-3 shadow-lg shadow-primary-900/5 ring-1 ring-black/5 animate-float sm:block">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Answer score</p>
      <p className="mt-0.5 text-2xl font-extrabold text-green-700">86%</p>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {[
          ['Relevance', '90%'],
          ['Clarity', '84%'],
          ['Correctness', '88%'],
          ['Depth', '80%'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-gray-50 px-1.5 py-1 text-center">
            <p className="text-[9px] text-gray-500">{label}</p>
            <p className="text-[11px] font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Floating communication card */}
    <div className="absolute -bottom-8 -left-4 hidden w-44 rounded-xl border border-gray-200 bg-white p-3 shadow-lg shadow-primary-900/5 ring-1 ring-black/5 animate-float-slow sm:block">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">Delivery</p>
      <p className="mt-1 text-xs text-gray-700">
        <span className="font-semibold text-gray-900">142 wpm</span> · 3 fillers ·
        2 pauses
      </p>
      <div className="mt-2 flex items-end gap-1">
        {[8, 14, 10, 18, 12, 20, 9].map((h, i) => (
          <span
            key={i}
            className="w-full rounded-sm bg-primary-200"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
    </div>
  </div>
);

const ReportPreview: React.FC = () => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-primary-900/5">
    <div className="border-b border-gray-100 px-6 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary-700">
        IntelliInterview
      </p>
      <p className="mt-0.5 font-semibold text-gray-900">Interview Assessment Report</p>
    </div>
    <div className="grid gap-4 p-6 sm:grid-cols-3">
      <div className="flex flex-col justify-center rounded-xl border border-primary-100 bg-gradient-to-b from-primary-50 to-white p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500">Overall score</p>
        <p className="mt-1 text-4xl font-extrabold text-green-700">78%</p>
        <p className="mt-1 text-[11px] text-gray-500">Weighted evaluation</p>
      </div>
      <div className="space-y-3 self-center sm:col-span-2">
        {[
          ['Technical', 'w-4/5', '80%'],
          ['Relevance', 'w-3/4', '76%'],
          ['Problem solving', 'w-[70%]', '70%'],
        ].map(([label, width, value]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium text-gray-500">
              {label}
            </span>
            <div className="h-2.5 flex-1 rounded-full bg-gray-100">
              <div
                className={`h-2.5 ${width} rounded-full bg-gradient-to-r from-primary-500 to-primary-600`}
              />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-gray-800">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-gray-100 px-6 py-4">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Question 1
          </p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">
            Explain the difference between REST and GraphQL…
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800">
              technical
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800">
              medium
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          82%
        </span>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        5 questions · 5 answers analyzed · strengths &amp; missing points per
        answer
      </p>
    </div>
  </div>
);

export const Landing: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Scroll-reveal: add .reveal-visible when elements enter the viewport.
  // Under prefers-reduced-motion the .reveal class is inert, so content
  // is always fully visible regardless of this observer.
  useEffect(() => {
    const targets = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('reveal-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* ── Navigation ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/75 backdrop-blur-lg">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="IntelliInterview home">
            <Logo />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-700"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-primary-700"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md"
            >
              Get started
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {menuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex gap-3 border-t border-gray-100 pt-4">
                <Link
                  to="/login"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-center text-sm font-medium text-white"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-50 via-white to-white"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-primary-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(99 102 241 / 0.08) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-16 md:pt-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-3 py-1 text-xs font-medium text-primary-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              AI-powered interview practice
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Master your next interview with{' '}
              <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                AI
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
              IntelliInterview analyzes your resume and the job description,
              then runs realistic mock interviews — text, audio, or video —
              with per-answer scoring, communication analysis, and a full
              assessment report.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/25"
              >
                Start Your Interview
              </Link>
              <a
                href="#features"
                className="rounded-lg border border-gray-300 bg-white/80 px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
              >
                Explore Features
              </a>
            </div>
            <p className="mt-6 text-xs text-gray-500">
              Upload a resume · Add a job description · Practice in minutes
            </p>
          </div>

          <div className="animate-fade-up lg:pl-6" style={{ animationDelay: '150ms' }}>
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section
        id="features"
        className="scroll-mt-20 border-t border-gray-100 bg-gradient-to-b from-gray-50/90 via-gray-50/50 to-white"
      >
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to practice with confidence
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              From resume parsing to a printable assessment report — one
              focused workflow, end to end.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className="reveal group rounded-2xl border border-gray-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-900/5"
                style={{ transitionDelay: `${(i % 3) * 60}ms` }}
              >
                <FeatureIcon path={feature.icon} />
                <h3 className="mt-5 text-[17px] font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how-it-works" className="relative scroll-mt-20 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-primary-100/40 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              From setup to report in four steps
            </h2>
          </div>

          <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-primary-200 to-transparent lg:block"
            />
            {STEPS.map((step, i) => (
              <li key={step.title} className="reveal relative">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-primary-200 bg-gradient-to-b from-white to-primary-50/60 text-sm font-bold text-primary-700 shadow-sm ring-4 ring-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Report preview ─────────────────────────────────────── */}
      <section
        id="report"
        className="relative scroll-mt-20 overflow-hidden border-t border-gray-100 bg-gradient-to-b from-gray-50/70 to-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-0 h-80 w-80 rounded-full bg-primary-100/40 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          <div className="reveal">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">
              Assessment reports
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Know exactly where you stand
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              Every completed interview produces a structured report: overall
              and per-dimension scores, question-by-question breakdowns with
              your answers and evaluations, delivery metrics for spoken
              answers, and concrete preparation recommendations.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Overall, technical, relevance, and problem-solving scores',
                'Question-wise answers with strengths and missing points',
                'Speech pace, filler, and pause observations for voice modes',
                'Printable, shareable report you can revisit from history',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal">
            <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary-100/50 to-transparent blur-xl"
            />
            <div className="relative">
              <ReportPreview />
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div className="reveal relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Walk into your next interview prepared
          </h2>
          <p className="mt-4 text-primary-100">
            Set up a mock interview in minutes and get feedback you can act on.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary-700 shadow-md transition-all hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-lg"
            >
              Start Your Interview
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-gray-600">
                AI-powered mock interviews with real feedback — practice
                smarter before the real thing.
              </p>
            </div>
            <nav aria-label="Product">
              <h3 className="text-sm font-semibold text-gray-900">Product</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
                <li>
                  <a
                    href="#features"
                    className="transition-colors hover:text-primary-700"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    className="transition-colors hover:text-primary-700"
                  >
                    How it works
                  </a>
                </li>
                <li>
                  <a
                    href="#report"
                    className="transition-colors hover:text-primary-700"
                  >
                    Reports
                  </a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Get started">
              <h3 className="text-sm font-semibold text-gray-900">Get started</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
                <li>
                  <Link
                    to="/register"
                    className="transition-colors hover:text-primary-700"
                  >
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login"
                    className="transition-colors hover:text-primary-700"
                  >
                    Log in
                  </Link>
                </li>
                <li>
                  <Link
                    to="/dashboard"
                    className="transition-colors hover:text-primary-700"
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Workflow">
              <h3 className="text-sm font-semibold text-gray-900">Workflow</h3>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Upload your resume</li>
                <li>Add a job description</li>
                <li>Practice and review</li>
              </ul>
            </nav>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 text-xs text-gray-500 sm:flex-row">
            <span>© {new Date().getFullYear()} IntelliInterview</span>
            <span>Practice interviews · Real feedback · Better outcomes</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
