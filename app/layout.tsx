import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Saha · Health Workspace',description:'One workspace for frontline visits, reviewed assistance and programme coordination.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
