import type {Metadata} from 'next';import type {ReactNode} from 'react';
export const metadata:Metadata={metadataBase:new URL('https://www.ame.guru')};
export default function Layout({children}:{children:ReactNode}){return children;}
