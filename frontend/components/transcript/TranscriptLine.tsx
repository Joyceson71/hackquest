'use client';

interface TranscriptLineProps {
  index: number;
  text: string;
  isHighlighted: boolean;
}

export default function TranscriptLine({ index, text, isHighlighted }: TranscriptLineProps) {
  return (
    <div
      id={`line-${index}`}
      data-line-index={index}
      className={`
        flex gap-4 px-3 py-1.5 rounded text-sm font-mono
        transition-colors duration-200
        ${isHighlighted ? 'evidence-highlight' : 'hover:bg-muted/50'}
      `}
    >
      <span className="text-muted-foreground select-none shrink-0 w-8 text-right tabular-nums">
        {index}
      </span>
      <span className="text-card-foreground break-words min-w-0">{text}</span>
    </div>
  );
}
