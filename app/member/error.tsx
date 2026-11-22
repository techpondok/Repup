"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="mp-card"><h1 className="mp-title">Something went wrong</h1><p className="mp-muted">Please try opening this page again.</p><button className="mp-button" onClick={reset}>Try again</button></section>}
