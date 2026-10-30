import {NextResponse} from 'next/server';
import {z} from 'zod';
import {findBreaks,findSwaps} from '@/lib/engine/matching';
const schema=z.object({mode:z.enum(['breaks','swaps']),master:z.array(z.record(z.unknown())).max(120000),negatives:z.array(z.record(z.unknown())).max(10000),threshold:z.number().min(0).max(1).optional(),priceTolerance:z.number().min(0).max(1).optional()});
export const runtime='nodejs';
export async function POST(request:Request){if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});try{const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Invalid request',details:parsed.error.flatten()},{status:400});const {mode,master,negatives,threshold,priceTolerance}=parsed.data;const result=mode==='breaks'?findBreaks(master as any,negatives as any,threshold??.8,true):findSwaps(master as any,negatives as any,threshold??.8,.9,priceTolerance??.25);return NextResponse.json({ok:true,...result});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Matching failed'},{status:500});}}
