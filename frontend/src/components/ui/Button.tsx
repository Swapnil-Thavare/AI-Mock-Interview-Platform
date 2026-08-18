import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50';
  const styles = {
    primary: `${base} bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500`,
    secondary: `${base} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300`,
    danger: `${base} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`,
  };

  return (
    <button className={`${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
