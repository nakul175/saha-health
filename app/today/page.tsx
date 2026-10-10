import type { Metadata } from 'next';
import Today from './today';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Saha · Today' };
// Protected data is fetched only through the server-authorised, audited projection.
export default function TodayPage() {
  return <Today />;
}
