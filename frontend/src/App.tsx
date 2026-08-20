import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Dashboard } from '@/pages/Dashboard';
import { Resume } from '@/pages/Resume';
import { JobDescription } from '@/pages/JobDescription';
import { InterviewSetup } from '@/pages/InterviewSetup';
import { Interview } from '@/pages/Interview';
import { InterviewResult } from '@/pages/InterviewResult';
import { InterviewHistory } from '@/pages/InterviewHistory';
import { Profile } from '@/pages/Profile';

const protectedRoutes = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/resume', element: <Resume /> },
  { path: '/job-description', element: <JobDescription /> },
  { path: '/interview/setup', element: <InterviewSetup /> },
  { path: '/interview', element: <Interview /> },
  { path: '/interview/result', element: <InterviewResult /> },
  { path: '/interviews', element: <InterviewHistory /> },
  { path: '/profile', element: <Profile /> },
];

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {protectedRoutes.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={<ProtectedRoute>{element}</ProtectedRoute>}
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
