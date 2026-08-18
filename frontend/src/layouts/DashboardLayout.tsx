import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';

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

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-10 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <NavLink to="/dashboard" className="text-xl font-bold text-primary-700">
            IntelliInterview
          </NavLink>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-600 md:inline">Aarav Sharma</span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="pt-16">
        <aside className="fixed bottom-0 left-0 top-16 w-56 border-r border-gray-200 bg-white p-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-lg px-4 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-h-[calc(100vh-4rem)] p-6 pl-64">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
};
