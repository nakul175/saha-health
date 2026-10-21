import type {Metadata} from 'next';
import DueWork from './due-work';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Saha · Due work and escalation'};
export default function DueWorkPage(){return <DueWork/>}
