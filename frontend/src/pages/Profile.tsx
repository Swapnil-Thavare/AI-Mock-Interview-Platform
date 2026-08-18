import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authService } from '@/services/authService';
import type { User } from '@/types';
import { mockDashboardStats } from '@/utils/mockData';

export const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    authService.getCurrentUser().then((u) => {
      setUser(u);
      if (u) setName(u.name);
    });
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Profile updated (mock).');
  };

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Profile</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Personal details</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" value={user?.email ?? ''} disabled />
            <Button type="submit" className="w-full">
              Save changes
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold">Your stats</h3>
          <dl className="space-y-3">
            <div className="flex justify-between border-b border-gray-100 py-2">
              <dt className="text-sm text-gray-600">Interviews</dt>
              <dd className="font-medium">{mockDashboardStats.totalInterviews}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <dt className="text-sm text-gray-600">Completed</dt>
              <dd className="font-medium">{mockDashboardStats.completedInterviews}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-sm text-gray-600">Average score</dt>
              <dd className="font-medium">{mockDashboardStats.averageScore}%</dd>
            </div>
          </dl>
        </Card>
      </div>
    </DashboardLayout>
  );
};
