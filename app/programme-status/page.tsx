import type { Metadata } from 'next';
import ProgrammeStatus from './programme-status';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Saha · Programme status' };
export default function ProgrammeStatusPage() { return <ProgrammeStatus />; }
