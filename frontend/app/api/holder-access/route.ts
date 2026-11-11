import {handleHolderAccess} from '@/lib/server/holder-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return handleHolderAccess(request);}
