import { useEffect, useState } from "react";

const FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function formatDateTime(value: string, timeZone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { ...FORMAT_OPTIONS, timeZone }).format(date);
}

export function LocalDateTime({ value }: { value: string }) {
  const [formatted, setFormatted] = useState(() => formatDateTime(value, "Asia/Shanghai"));

  useEffect(() => setFormatted(formatDateTime(value)), [value]);

  return <time dateTime={value}>{formatted}</time>;
}
