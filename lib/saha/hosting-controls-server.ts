import {fail} from './core';
import {hostingControlsView} from './hosting-controls';
import {identity,json,loadFor} from './server';
import {scope} from './store';

export async function hostingControlsRead(request:Request){const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);if(!m.isOwner)fail(403,'Only an organisation owner can view hosting and cross-border controls.');return json(hostingControlsView(s));}
