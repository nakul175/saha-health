export type ProviderSelfServiceContract={
 environment:'synthetic-provider-sandbox';
 isolation:'organisation-bound-logical-isolation';
 capabilityProviderId:string;
 allowed:readonly string[];
 prohibited:readonly string[];
 productionActivationPath:readonly string[];
};

// Response-safe and deliberately honest: application gates provide organisation-bound logical isolation.
// A separate deployment/database remains an external delivery decision and is never inferred here.
export const providerSelfServiceContract=(sandbox:{providerId:string}):ProviderSelfServiceContract=>({
 environment:'synthetic-provider-sandbox',
 isolation:'organisation-bound-logical-isolation',
 capabilityProviderId:sandbox.providerId,
 allowed:['maintain-own-documentation','record-test-credential-reference','propose-own-capability-version','run-approved-synthetic-evaluation'],
 prohibited:['read-patient-records','read-other-provider-proposals','review-own-proposal','activate-sandbox-capability','publish-directly-to-production'],
 productionActivationPath:['owner-imports-draft','production-synthetic-evaluation','independent-clinical-review','owner-activation']
});
