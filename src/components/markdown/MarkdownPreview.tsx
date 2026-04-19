interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

const blockStarters = [
  /^#{1,6}\s+/,
  /^>\s?/,
  /^[-*+]\s+/,
  /^\d+\.\s+/,
  /^```/,
  /^---$/,
];

export default function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div
      className={className ? `md-preview ${className}` : "md-preview"}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

export function markdownToPlainText(content: string): string {
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, " ");
  const withoutInlineCode = withoutCodeBlocks.replace(/`([^`]+)`/g, "$1");
  const withoutLinks = withoutInlineCode.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  const withoutFormatting = withoutLinks.replace(/[*_~>#-]/g, " ");
  return withoutFormatting.replace(/\s+/g, " ").trim();
}

function renderMarkdown(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n");
  const html: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const languageLabel = language ? `<div class="md-code-lang">${escapeHtml(language)}</div>` : "";
      html.push(
        `<pre class="md-code-block">${languageLabel}<code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    if (/^---$/.test(trimmed)) {
      html.push("<hr />");
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }

      html.push(`<blockquote>${quoteLines.map((quoteLine) => renderInlineMarkdown(quoteLine)).join("<br />")}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }

      html.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      html.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate) {
        break;
      }

      if (paragraphLines.length > 0 && blockStarters.some((pattern) => pattern.test(candidate))) {
        break;
      }

      paragraphLines.push(lines[index]);
      index += 1;
    }

    html.push(`<p>${renderInlineMarkdown(paragraphLines.join("\n"))}</p>`);
  }

  return html.join("");
}

function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  const codeSegments: string[] = [];

  const withCodePlaceholders = escaped.replace(/`([^`]+)`/g, (_, code: string) => {
    const placeholder = `@@CODE_${codeSegments.length}@@`;
    codeSegments.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  const withLinks = withCodePlaceholders.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label: string, href: string) => {
    const safeHref = sanitizeHref(href);
    const safeLabel = label.trim() ? label : href;
    if (!safeHref) {
      return safeLabel;
    }

    return `<a href="${safeHref}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
  });

  const withStrong = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const withEmphasis = withStrong.replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  const withStrikethrough = withEmphasis.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  const withBreaks = withStrikethrough.replace(/\n/g, "<br />");

  return codeSegments.reduce(
    (result, segment, segmentIndex) => result.replace(`@@CODE_${segmentIndex}@@`, segment),
    withBreaks,
  );
}

function sanitizeHref(href: string): string | null {
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) {
    return escapeHtml(href);
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
