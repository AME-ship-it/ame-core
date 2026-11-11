import {createElement as h,Fragment,type ReactNode} from 'react';
import type {HolderPresentation} from '../lib/holder-access.ts';

/** Presentational boundary only. Its state comes from server verification, never browser storage. */
export function HolderAccessBoundary({state,classes={},canRefresh=false,refreshing=false,onRefresh,tokenURL,children}:{state:HolderPresentation;classes?:Record<string,string>;canRefresh?:boolean;refreshing?:boolean;onRefresh?:()=>void;tokenURL?:string|null;children?:ReactNode}){
  if(state==='unlocked')return h(Fragment,null,children);
  const title=state==='disconnected'?'CONNECT WALLET TO ACCESS LENDING':state==='checking'?'VERIFYING $AME BALANCE':state==='prelaunch'?'LENDING ACCESS':state==='not-holder'?'HOLDER ACCESS REQUIRED':'VERIFICATION UNAVAILABLE';
  const copy=state==='prelaunch'?'Holder verification will activate with the $AME launch.':state==='not-holder'?'Your wallet does not currently meet the $AME holder requirement. Hold $AME to unlock access to the credit layer.':state==='checking'?'Reading your token balance. No signature is required.':state==='disconnected'?'Connect your wallet using the existing header control. Holder access activates with the $AME launch.':'Unable to verify holder access right now. This does not mean you are a non-holder. Please refresh verification.';
  return h('section',{className:classes.gate,'aria-labelledby':'holder-access-title','aria-live':'polite'},
    h('p',{className:classes.state},'LOCKED'),h('h2',{id:'holder-access-title'},title),h('p',null,copy),
    h('div',{className:classes.actions},state==='not-holder'&&tokenURL?h('a',{className:'text-link',href:tokenURL,target:'_blank',rel:'noopener noreferrer'},'Get $AME →'):null,canRefresh?h('button',{className:'wallet',disabled:refreshing,onClick:onRefresh},'Refresh verification ↻'):null),
    h('small',null,'Holder eligibility controls product access. Agent ownership, creditworthiness and transaction authorization are checked separately. Verification never requests a wallet signature.'));
}
