import {handleHolderAccess} from '@/lib/server/holder-access';
import {withApiMetrics} from '@/lib/server/api-guard';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=withApiMetrics('holder-access',handleHolderAccess);
