import type { ReactNode } from "react";

export const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-3 mt-0 text-2xl font-semibold leading-tight text-black">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold leading-tight text-black first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold leading-snug text-black">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-sm leading-[1.65] text-black">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-bold text-black">{children}</strong>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-[1.6] text-black">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm leading-[1.6] text-black">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-4 border-[#fbbd41] bg-[#fff8e5] py-2 pl-3 pr-2 text-sm text-[#55534e]">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-[#eee9df] px-1 py-0.5 font-mono text-[13px] text-black">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-3 overflow-auto rounded-lg border border-[#dad4c8] bg-[#faf9f7] p-3 font-mono text-[13px] leading-relaxed text-black">
      {children}
    </pre>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-auto rounded-lg border border-[#dad4c8]">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-[#dad4c8] bg-[#fff8e5] px-3 py-2 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-[#eee9df] px-3 py-2">{children}</td>
  ),
};
