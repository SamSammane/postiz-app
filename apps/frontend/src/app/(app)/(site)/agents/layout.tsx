import { Metadata } from 'next';
import { Agent } from '@gitroom/frontend/components/agents/agent';
export const metadata: Metadata = {
  title: 'Trelexa.ai - Agent',
  description: '',
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Agent>{children}</Agent>;
}
