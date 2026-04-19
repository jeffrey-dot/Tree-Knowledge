import { parseLlmCandidatesPreview } from "../../lib/llmStream";

export default function StructuredCandidatesStreamPreview({
  rawPreview,
  error,
  waitingMessage,
}: {
  rawPreview: string;
  error: string | null;
  waitingMessage: string;
}) {
  if (error) {
    return <p className="text-sm leading-relaxed text-red-300">{error}</p>;
  }

  if (!rawPreview) {
    return <p className="text-sm leading-relaxed text-stone-500">{waitingMessage}</p>;
  }

  const candidates = parseLlmCandidatesPreview(rawPreview);
  if (candidates.length === 0) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-300">
        {rawPreview}
      </pre>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {candidates.map((candidate, index) => (
        <div
          key={`${candidate.title ?? "candidate"}-${index}`}
          className="min-w-[220px] max-w-[220px] shrink-0 rounded-[1.35rem] border border-blue-300/14 bg-white/5 p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-300/80">
              AI Suggestion
            </div>
            {candidate.relationType && (
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-stone-500">
                {candidate.relationType.replace(/_/g, " ")}
              </div>
            )}
          </div>

          {candidate.title && (
            <h5 className="mb-2 text-[11px] font-black uppercase tracking-[0.06em] text-white line-clamp-2">
              {candidate.title}
            </h5>
          )}

          {candidate.summary && (
            <p className="line-clamp-3 text-[11px] leading-relaxed text-stone-400">
              {candidate.summary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
