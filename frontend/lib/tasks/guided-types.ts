import type {TaskType,TaskSubmission} from './model.ts';
export type GuideQuestion={id:string;label:string;hint?:string;kind:'number'|'choice';options?:{id:string;label:string}[]};
export type GuidedTask={ticket:string;type:TaskType;agentId:string;target:string|null;expiresAt:string;properties:{label:string;value:string}[];questions:GuideQuestion[];evidence:{id:string;blockNumber:string;blockHash:string;version:string;codeHash?:string};identity:{owner:string;assignedWallet:string};signatureMessage?:string;walletAuthorized:boolean;};
export type GuidedResult={verified:boolean;checks:{label:string;correct:boolean;explanation:string}[];recorded:false;xpAwarded:0;message:string;evidence:GuidedTask['evidence'];snapshot?:Record<string,string>};
export type GuidedRecordPreparation={agentId:string;type:TaskType;submission:TaskSubmission};
