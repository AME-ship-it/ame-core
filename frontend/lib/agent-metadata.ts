export type AgentMetadataInput={name?:string;description?:string};
export function identityMetadata(agentWallet:string,input:AgentMetadataInput={}){
  const name=input.name?.trim()||'AME Agent';
  const description=input.description?.trim()||'An onchain NFT identity. No autonomous runtime or financial permissions are enabled.';
  if(name.length>64||description.length>500)throw new Error('METADATA INVALID — Name must be at most 64 characters; description at most 500.');
  return `data:application/json,${encodeURIComponent(JSON.stringify({name,description,agentWallet}))}`;
}
// Never fetch arbitrary tokenURIs or render metadata as HTML. The onchain pointer remains visible.
export function parseIdentityMetadata(uri:string):{name:string|null;description:string|null;issue:string|null}{
  if(uri.length>32768)return {name:null,description:null,issue:'Metadata exceeds the preview size limit.'};
  const match=/^data:application\/json(;base64)?,(.*)$/s.exec(uri);
  if(!match)return {name:null,description:null,issue:'External metadata is not fetched automatically. Inspect the onchain pointer independently.'};
  try{
    const text=match[1]?new TextDecoder().decode(Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))):decodeURIComponent(match[2]);
    const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid object');
    return {name:typeof data.name==='string'?data.name.slice(0,256):null,description:typeof data.description==='string'?data.description.slice(0,4096):null,issue:null};
  }catch{return {name:null,description:null,issue:'Metadata is not valid inline JSON.'};}
}
