import React from 'react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle }) => {
  return (
    <Card className="flex flex-col justify-between">
      <h4 className="text-sm font-medium text-gray-500">{title}</h4>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </Card>
  );
};
