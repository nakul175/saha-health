// Existing minimal-DOM clinical tests use real encrypted metadata CAS, while
// historical upload/correlation is isolated from their clinical network order.
// Real metadata transport/receipt/privacy behavior has dedicated contract and
// Chromium/Worker/D1 coverage in offline-opens-*.
import {queueOfflineMetadata,localRegistrationReference,pendingOfflineOpens,abandonUnsentOfflineCopy} from '../../public/field/offline-opens.js';
import {fieldBurdenCapture} from '../../public/field/burden-capture.js';
export function offlineOpenHarness(storage){return {fieldBurdenCapture,setInterval:()=>0,
 queueOfflineMetadata:(...args)=>queueOfflineMetadata(...args,{write:(...values)=>storage()(...values)}),localRegistrationReference,pendingOfflineOpens,abandonUnsentOfflineCopy,
 flushOfflineOpens:async(book,_key,_salt,revision)=>({book,revision}),queueAcceptedOpenMappings:async(book,_key,_salt,revision)=>({book,revision}),
};}
