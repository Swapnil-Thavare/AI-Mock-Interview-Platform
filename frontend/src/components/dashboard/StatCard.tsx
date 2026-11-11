import React from 'react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon }) => {
  return (
    <Card className="group flex flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-900/5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-500">{title}</h4>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/70 text-primary-600 ring-1 ring-primary-100">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </Card>
  );
};
