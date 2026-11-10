import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/components/Web3Provider';

export const metadata: Metadata = {
  title: 'AME — Financial reputation for machines',
  description: 'An onchain financial identity and reputation layer for autonomous AI agents.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Web3Provider>{children}</Web3Provider></body></html>;
}
