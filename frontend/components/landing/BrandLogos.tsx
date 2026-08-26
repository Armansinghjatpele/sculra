'use client';

import * as React from 'react';

export function GithubLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

export function VercelLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className="h-5 w-5" {...props}>
      <path fillRule="evenodd" d="M256 48L496 464H16L256 48z"/>
    </svg>
  );
}

export function StripeLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-8" {...props}>
      <path d="M13.962 8.885c0-1.35-.923-2.091-2.462-2.091-1.697 0-2.778.618-3.023 1.8l-2.274-.48c.513-2.126 2.548-3.12 5.297-3.12 3.207 0 4.78 1.644 4.78 3.9 0 3.507-4.786 4.143-4.786 5.703 0 .72.632 1.037 1.54 1.037 1.632 0 2.771-.66 3.013-1.8l2.253.48c-.512 2.271-2.625 3.12-5.266 3.12-3.23 0-4.838-1.637-4.838-3.9 0-3.59 4.786-4.214 4.786-5.65z"/>
    </svg>
  );
}

export function LinearLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" {...props}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/>
    </svg>
  );
}

export function FramerLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" {...props}>
      <path d="M5 2h14v6H12l7 7H5v-6h7z"/>
    </svg>
  );
}
