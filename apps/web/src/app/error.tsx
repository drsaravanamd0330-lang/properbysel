"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <div className="container section center"><h1>Something went wrong</h1><p className="muted">Please try again. If it keeps happening, check your connection.</p><button className="btn btn-primary" onClick={reset}>Try again</button></div>;
}
