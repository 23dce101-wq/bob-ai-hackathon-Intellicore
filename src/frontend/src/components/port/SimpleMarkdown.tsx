// Minimal markdown renderer (headings, bullets, bold, paragraphs) — enough for
// the AI plan and copilot answers without adding a dependency.
export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");

  const renderInline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="text-foreground">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      ),
    );

  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
          {list.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flush();
    if (!line.trim()) return;
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <h3
          key={`h-${idx}`}
          className="mt-4 mb-1 text-sm font-semibold tracking-wide text-primary uppercase"
        >
          {heading[2]}
        </h3>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${idx}`} className="my-1.5 leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  });
  flush();

  return <div className="text-sm text-muted-foreground">{blocks}</div>;
}
