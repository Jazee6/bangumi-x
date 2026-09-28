export function DetailField({
  label,
  value,
  title,
  ariaLabel,
}: {
  label: string;
  value: string;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium" title={title} aria-label={ariaLabel}>
        {value}
      </dd>
    </div>
  );
}
