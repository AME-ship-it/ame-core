import {createElement as h,Fragment,type ReactNode} from 'react';
import type {HolderPresentation} from '../lib/holder-access.ts';

/** Presentational boundary only. Its state comes from server verification, never browser storage. */
export function HolderAccessBoundary({state,classes={},canRefresh=false,refreshing=false,onRefresh,tokenURL,children}:{state:HolderPresentation;classes?:Record<string,string>;canRefresh?:boolean;refreshing?:boolean;onRefresh?:()=>void;tokenURL?:string|null;children?:ReactNode}){
  if(state==='unlocked')return h(Fragment,null,children);
  const title=state==='disconnected'?'CONNECT WALLET TO ACCESS LENDING':state==='checking'?'VERIFYING $AME BALANCE':state==='holder-no-entitlements'?'HOLDER / ACCESS RULES PENDING':state==='prelaunch'?'LENDING ACCESS':state==='not-holder'?'HOLDER ACCESS REQUIRED':'VERIFICATION UNAVAILABLE';
  const copy=state==='holder-no-entitlements'?'Your positive $AME balance is verified. Premium and lending access rules are not activated.':state==='prelaunch'?'Holder access rules are not activated.':state==='not-holder'?'Your wallet does not currently meet the $AME holder requirement. Token ownership alone does not grant credit or premium permissions.':state==='checking'?'Reading your token balance. No signature is required.':state==='disconnected'?'Connect your wallet using the existing header control. Connect to verify your $AME balance. Product access follows the approved holder rules.':'Unable to verify holder access right now. This does not mean you are a non-holder. Please refresh verification.';
  return h('section',{className:classes.gate,'aria-labelledby':'holder-access-title','aria-live':'polite'},
    h('p',{className:classes.state},'LOCKED'),h('h2',{id:'holder-access-title'},title),h('p',null,copy),
    h('div',{className:classes.actions},state==='not-holder'&&tokenURL?h('a',{className:'text-link',href:tokenURL,target:'_blank',rel:'noopener noreferrer'},'Get $AME →'):null,canRefresh?h('button',{className:'wallet',disabled:refreshing,onClick:onRefresh},'Refresh verification ↻'):null),
    h('small',null,'Holder eligibility controls product access. Agent ownership, creditworthiness and transaction authorization are checked separately. Verification never requests a wallet signature.'));
}
