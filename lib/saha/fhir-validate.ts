import { AppError, fail } from './core';
import { inspectDocument } from './fhir-document';

// Slice 7c: one pinned, versioned rule set applied to every outbound FHIR document (EHR publication
// and the mock ABDM HIP) and to documents received over the mock ABDM transfer (BR-INT-17). It is a
// local structural subset of HL7 FHIR R4, not the NRCeS implementation guide: no profile package,
// terminology server or ABDM validator is installed.
export const VALIDATION_RULESET={
 id:'saha-fhir-r4-document-structure',
 version:'1.0.0',
 fhirVersion:'4.0.1',
 basis:[
  'HL7 FHIR R4 Bundle invariants bdl-7 (unique fullUrl), bdl-9 (document identifier with system and value), bdl-10 (document timestamp) and bdl-11 (Composition first)',
  'Saha structural subset: permitted resource types, one Composition and one Patient, every reference resolved inside the bundle, final Composition with type, title and author, dated observations with time zone, UCUM units for the supported LOINC vital signs',
 ],
 profilePackage:null,
 terminology:null,
} as const;
export type ValidationStamp={ruleset:string;version:string;fhirVersion:string;checkedAt:string;warnings:string[]};
// Returns a stamp for a document that passes; otherwise refuses with the rule set, version and the
// specific failure, before anything is encrypted, stored or sent.
export function validateOutbound(bundle:unknown,expectedPatientId?:string,now=new Date().toISOString()):ValidationStamp{
 try{const summary=inspectDocument(bundle,expectedPatientId);return {ruleset:VALIDATION_RULESET.id,version:VALIDATION_RULESET.version,fhirVersion:VALIDATION_RULESET.fhirVersion,checkedAt:now,warnings:summary.warnings};}
 catch(e){if(e instanceof AppError)fail(422,`Document failed ${VALIDATION_RULESET.id} ${VALIDATION_RULESET.version}: ${e.message} Nothing was sent.`);throw e;}
}
