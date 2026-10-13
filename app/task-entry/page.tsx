import type { Metadata } from 'next';
import TaskEntry from './task-entry';
export const metadata: Metadata = { title: 'Saha · Task shortcuts' };
export default function TaskEntryPage() { return <TaskEntry />; }
