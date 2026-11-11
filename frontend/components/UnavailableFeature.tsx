import Link from 'next/link';
import { ProductShell } from './ProductShell';

export function UnavailableFeature({ name, description }: { name: string; description: string }) {
  return <ProductShell><p className="eyebrow">// PROTOCOL MODULE</p><h1 className="product-title">{name}_</h1>
    <p className="product-copy" role="status">NOT AVAILABLE — {description}</p>
    <p className="product-copy">Data is unavailable for this module.</p>
    <div className="product-actions"><Link className="wallet" href="/agents">VIEW AGENTS ↗</Link><Link className="wallet" href="/">RETURN HOME ↗</Link></div>
  </ProductShell>;
}
