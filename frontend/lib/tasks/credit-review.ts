import type {TaskRecord} from './model.ts';
import {reputation} from './model.ts';
/** Internal read-only boundary. No financial permissions or lending-policy decisions. */
export function activityForCreditReview(records:TaskRecord[],epoch:string){return {schema:'ame-activity-review-v1',activity:reputation(records,epoch),financialHistoryVerified:false,creditDecisionAllowed:false,requiredApprovals:['independent-risk-model','verified-financial-history','market-security-review','manipulation-review','explicit-protocol-approval'] as const};}
