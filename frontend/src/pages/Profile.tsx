import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { interviewService } from '@/services/interviewService';

const joinStrings = (value: string[] | string | undefined): string => {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
};

const splitStrings = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const Profile: React.FC = () => {
  const { user, loading } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ total: 0, completed: 0, average: 0 });

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setPhone(user.phone ?? '');
      setSkills(joinStrings(user.skills));
      setEducation(joinStrings(user.education));
      setExperience(joinStrings(user.experience));
    }
  }, [user]);

  useEffect(() => {
    interviewService
      .getHistory()
      .then((interviews) => {
        const completed = interviews.filter((i) => i.status === 'completed');
        const scores = completed
          .map((i) => i.result?.score)
          .filter((s): s is number => typeof s === 'number');
        const average = scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        setStats({ total: interviews.length, completed: completed.length, average });
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await authService.updateMe({
        name,
        phone,
        skills: splitStrings(skills),
        education: splitStrings(education),
        experience: splitStrings(experience),
      });
      setMessage('Profile updated.');
    } catch {
      setMessage('Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-gray-600">Loading profile...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Profile</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Personal details</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input
              label="Skills (comma separated)"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <Textarea
              label="Education (comma or newline separated)"
              rows={3}
              value={education}
              onChange={(e) => setEducation(e.target.value)}
            />
            <Textarea
              label="Experience (comma or newline separated)"
              rows={3}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
            {message && (
              <p className={`text-sm ${message.includes('Could not') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold">Your stats</h3>
          <dl className="space-y-3">
            <div className="flex justify-between border-b border-gray-100 py-2">
              <dt className="text-sm text-gray-600">Interviews</dt>
              <dd className="font-medium">{stats.total}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <dt className="text-sm text-gray-600">Completed</dt>
              <dd className="font-medium">{stats.completed}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-sm text-gray-600">Average score</dt>
              <dd className="font-medium">{stats.average}%</dd>
            </div>
          </dl>
        </Card>
      </div>
    </DashboardLayout>
  );
};
