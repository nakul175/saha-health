import type { Metadata } from 'next';
import Followups from './follow-ups';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Saha · Planned follow-ups' };
export default function FollowupsPage() { return <Followups />; }
