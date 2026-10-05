import type { Metadata } from 'next';
import WorkspaceApp from '../workspace';
import { requireChatGPTUser } from '../chatgpt-auth';
import { headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import { identityConfig, principalFromHeaders } from '@/lib/saha/identity';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Saha · Frontline app',manifest:'/app-manifest.webmanifest'};
// Slice 0c: the trusted identity provider is chosen per deployment (lib/saha/identity.ts).
export default async function FrontlineApp(){
 if(!import.meta.env.DEV){
  const config=identityConfig(env as unknown as Record<string,unknown>);
  if(config.provider==='sites-chatgpt'&&!config.error)await requireChatGPTUser('/app');
  else if(config.error||!await principalFromHeaders(await headers(),config))return <main style={{padding:32,fontFamily:'system-ui'}}><h1>Sign-in required</h1><p>Open Saha through your organisation&apos;s access gateway. If you already did, ask your administrator to check the sign-in configuration.</p></main>;
 }
 return <WorkspaceApp appFirst/>;
}
