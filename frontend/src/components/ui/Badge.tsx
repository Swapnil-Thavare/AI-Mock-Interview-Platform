import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'green' | 'yellow' | 'red' | 'primary';
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'gray' }) => {
  const colors = {
    gray: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    primary: 'bg-primary-100 text-primary-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
};
