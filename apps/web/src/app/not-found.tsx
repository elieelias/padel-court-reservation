import Link from "next/link";

export default function NotFound() {
  return <section className="not-found"><span className="eyebrow">404</span><h1>This page is outside the court.</h1><Link className="button button--primary" href="/">Return home</Link></section>;
}
