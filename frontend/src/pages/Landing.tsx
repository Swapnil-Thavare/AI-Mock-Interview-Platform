import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-2xl font-bold text-primary-700">IntelliInterview</span>
        <div className="flex gap-3">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Get started
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 md:text-6xl">
          Master your next interview with AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          IntelliInterview analyzes your resume and job description, then simulates real
          interviews with instant feedback so you can improve faster.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/register">
            <Button>Start for free</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            ['Upload resume', 'We extract your skills, experience and improvement areas.'],
            ['Add job description', 'We match your profile against the role requirements.'],
            ['Mock interviews', 'Practice with AI-generated questions and get feedback.'],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
