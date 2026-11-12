'use client';

import { Navigate, useNavigate, useParams } from '@/landing/shims/router';
import CareerApplicationModal from '@/landing/components/CareerApplicationModal';

/**
 * Full-page career application.
 *   /careers/apply/tutor
 *   /careers/apply/campus-leader
 * All form logic (validation, auth, submission) lives unchanged in CareerApplicationModal.
 */
export default function CareerApply() {
  const { role } = useParams();
  const navigate = useNavigate();

  if (role !== 'tutor' && role !== 'campus-leader') {
    return <Navigate to="/careers" replace />;
  }

  return (
    <CareerApplicationModal
      key={role}
      isOpen
      role={role}
      onClose={() => navigate('/careers')}
    />
  );
}
