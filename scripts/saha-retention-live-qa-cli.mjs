#!/usr/bin/env node
import {retentionLiveQaMain} from './saha-retention-live-qa.mjs';

retentionLiveQaMain().catch(error=>{
 process.stderr.write(`SAHA retention live QA refused: ${error.message}\n`);
 process.exitCode=1;
});
