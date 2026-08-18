import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  footer,
}) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <Link to="/" className="text-2xl font-bold text-primary-700">
            IntelliInterview
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
};
