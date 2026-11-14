import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="mb-4 flex items-center gap-2.5">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/70 text-primary-600 ring-1 ring-primary-100">
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon}
      </svg>
    </span>
    <h3 className="font-semibold text-gray-900">{title}</h3>
  </div>
);

export const Profile: React.FC = () => {
  const { user, loading, updateUser } = useAuth();
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
      const updated = await authService.updateMe({
        name,
        full_name: name,
        phone,
        skills: splitStrings(skills),
        education: splitStrings(education),
        experience: splitStrings(experience),
      });
      updateUser(updated);
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
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2">
            <div className="h-7 w-40 rounded bg-gray-200 motion-safe:animate-pulse" />
            <div className="h-4 w-64 rounded bg-gray-100 motion-safe:animate-pulse" />
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="h-72 rounded-xl border border-gray-200 bg-white lg:col-span-3" />
            <div className="h-48 rounded-xl border border-gray-200 bg-white lg:col-span-2" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const initial = (user?.name || user?.email || 'C').charAt(0).toUpperCase();
  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Profile</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your personal details and see your interview activity.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        {/* Personal details form */}
        <Card className="lg:col-span-3">
          <SectionHeading
            title="Personal details"
            icon={
              <>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </>
            }
          />
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
              <p
                role={message.includes('Could not') ? 'alert' : 'status'}
                className={`rounded-lg px-4 py-3 text-sm ring-1 ${
                  message.includes('Could not')
                    ? 'bg-red-50 text-red-600 ring-red-200'
                    : 'bg-green-50 text-green-700 ring-green-200'
                }`}
              >
                {message}
              </p>
            )}
            <Button type="submit" className="w-full shadow-sm shadow-primary-600/20" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Card>

        {/* Identity + activity */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white shadow-sm">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">
                  {user?.name || 'Candidate'}
                </p>
                <p className="truncate text-sm text-gray-500">{user?.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {user?.role && (
                    <Badge color="primary">
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  )}
                  {joined && <Badge color="gray">Joined {joined}</Badge>}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Interview activity"
              icon={
                <>
                  <path d="M3 3v18h18" />
                  <path d="m7 15 4-5 4 3 5-7" />
                </>
              }
            />
            <dl className="space-y-1">
              <div className="flex items-center justify-between border-b border-gray-100 py-2.5">
                <dt className="flex items-center gap-2 text-sm text-gray-600">
                  <svg
                    className="h-4 w-4 text-primary-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                  </svg>
                  Interviews
                </dt>
                <dd className="text-sm font-semibold text-gray-900">{stats.total}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 py-2.5">
                <dt className="flex items-center gap-2 text-sm text-gray-600">
                  <svg
                    className="h-4 w-4 text-green-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m8 12 3 3 5-6" />
                  </svg>
                  Completed
                </dt>
                <dd className="text-sm font-semibold text-gray-900">{stats.completed}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="flex items-center gap-2 text-sm text-gray-600">
                  <svg
                    className="h-4 w-4 text-primary-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m22 7-8.5 8.5-5-5L2 17" />
                    <path d="M16 7h6v6" />
                  </svg>
                  Average score
                </dt>
                <dd className="text-sm font-semibold text-gray-900">{stats.average}%</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
