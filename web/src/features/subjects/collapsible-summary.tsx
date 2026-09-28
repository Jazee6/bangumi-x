import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function CollapsibleSummary({ text }: { text: string }) {
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary) {
      return;
    }

    const updateOverflow = () => {
      if (!expanded) {
        setOverflowing(summary.scrollHeight > summary.clientHeight + 1);
      }
    };

    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(summary);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div className="relative">
      <p
        ref={summaryRef}
        className={expanded ? "whitespace-pre-line" : "line-clamp-5 pr-12 whitespace-pre-line"}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <Button
          type="button"
          variant={expanded ? "link" : "summary"}
          size={expanded ? "inline" : "summary"}
          aria-expanded={expanded}
          className={expanded ? "mt-1" : "absolute right-0 bottom-0"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起" : "展开"}
        </Button>
      )}
    </div>
  );
}
