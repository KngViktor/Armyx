import { Suspense } from 'react';
import { ApplicationWizard } from '@/components/portal/ApplicationWizard';

export const metadata = { title: 'Application form' };

export default function ApplyPage() {
  return <Suspense><ApplicationWizard /></Suspense>;
}
