import { AgentProfile } from '@/components/AgentProfile';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentProfile id={id} />;
}
