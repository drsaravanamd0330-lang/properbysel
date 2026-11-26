import Link from "next/link";
export default function NotFound() {
  return <div className="container section center"><h1>Page not found</h1><p className="muted">The page or property you are looking for does not exist or is no longer listed.</p><Link className="btn btn-primary" href="/search">Search properties</Link></div>;
}
