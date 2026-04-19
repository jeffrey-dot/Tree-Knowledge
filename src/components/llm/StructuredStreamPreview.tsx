import { parseLlmGenerationPreview } from "../../lib/llmStream";
import MarkdownPreview from "../markdown/MarkdownPreview";

export default function StructuredStreamPreview({
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

  const preview = parseLlmGenerationPreview(rawPreview);
  const hasStructuredPreview = Boolean(preview.title || preview.summary || preview.body);

  if (!rawPreview) {
    return <p className="text-sm leading-relaxed text-gray-500">{waitingMessage}</p>;
  }

  if (!hasStructuredPreview) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">
        {rawPreview}
      </pre>
    );
  }

  return (
    <div className="space-y-5">
      {preview.title && (
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-blue-300/80">
            Draft Title
          </div>
          <h4 className="text-2xl font-black uppercase tracking-tight text-white">
            {preview.title}
          </h4>
        </div>
      )}

      {preview.summary && (
        <div className="rounded-[1.5rem] border border-white/5 bg-white/5 p-4">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
            Draft Summary
          </div>
          <p className="text-sm font-medium italic leading-relaxed text-gray-200">
            {preview.summary}
          </p>
        </div>
      )}

      {preview.body && (
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
            Draft Body
          </div>
          <MarkdownPreview content={preview.body} className="text-sm leading-relaxed text-gray-300" />
        </div>
      )}
    </div>
  );
}
