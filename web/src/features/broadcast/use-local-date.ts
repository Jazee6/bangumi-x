import { useEffect, useState } from "react";

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextMidnightDelay(value: Date): number {
  const next = new Date(value);
  next.setHours(24, 0, 0, 0);
  return Math.max(1, next.getTime() - value.getTime());
}

export function useLocalDate(): string | null {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setToday(localDate(now));
      timeout = setTimeout(update, nextMidnightDelay(now));
    };
    update();
    return () => clearTimeout(timeout);
  }, []);

  return today;
}
