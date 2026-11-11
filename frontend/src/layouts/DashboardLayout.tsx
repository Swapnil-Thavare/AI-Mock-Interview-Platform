import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/resume', label: 'Resume' },
  { to: '/job-description', label: 'Job Description' },
  { to: '/interview/setup', label: 'New Interview' },
  { to: '/interviews', label: 'History' },
  { to: '/profile', label: 'Profile' },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-10 border-b border-gray-200/80 bg-white/90 px-6 py-4 shadow-sm backdrop-blur print:hidden">
        <div className="flex items-center justify-between">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <svg
                className="h-4 w-4"
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
          </NavLink>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 md:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                {(user?.name || 'C').charAt(0).toUpperCase()}
              </span>
              <span className="text-sm text-gray-600">{user?.name || 'Candidate'}</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="pt-16 print:pt-0">
        {/* Mobile navigation */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 font-semibold text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop sidebar */}
        <aside className="fixed bottom-0 left-0 top-16 hidden w-56 border-r border-gray-200 bg-white p-4 md:block print:hidden">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-lg border-l-2 px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary-600 bg-primary-50 font-semibold text-primary-700'
                      : 'border-transparent text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:pl-64 print:p-0 md:print:pl-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
