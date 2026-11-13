import type {TaskRecord,reputation} from '../tasks/model.ts';
export type Passport={
 schema:'ame-passport-v3';agentId:string;chainId:4663;registry:string;url:string;checkedAt:string;
 identity:{owner:string;assignedWallet:string;epoch:string;blockNumber:string;blockHash:string;name:string|null;description:string|null;metadataURI:string|null;mint:{transaction:string;block:string;timestamp:string}|null;issues:string[]};
 activity:{status:'available'|'unavailable'|'inconsistent';xp:number|null;verifiedCount:number|null;history:TaskRecord[]|null;reputation:ReturnType<typeof reputation>|null;issue:string|null};
 verification:{ownership:'onchain';activity:'server-attested'|'unavailable';signatures:'checked-at-submission-not-publicly-retained';financialUseApproved:false};
};
