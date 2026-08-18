import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/resume" element={<Resume />} />
      <Route path="/job-description" element={<JobDescription />} />
      <Route path="/interview/setup" element={<InterviewSetup />} />
      <Route path="/interview" element={<Interview />} />
      <Route path="/interview/result" element={<InterviewResult />} />
      <Route path="/interviews" element={<InterviewHistory />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
