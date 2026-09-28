import { HeaderTitle } from "@/components/app-shell";
import { DetailField } from "@/components/detail-field";
import { DetailShareButton } from "@/components/detail-share-button";
import { EntityImage } from "@/components/entity-image";
import { SummaryEmpty } from "@/components/empty-states";
import { CollapsibleSummary } from "@/features/subjects/collapsible-summary";

interface EntityDetailProps {
  name: string;
  imageUrl: string | null;
  type: string;
  fields: Array<{ label: string; value: string | null }>;
  summary: string | null;
  children?: React.ReactNode;
}

export function EntityDetail({
  name,
  imageUrl,
  type,
  fields,
  summary,
  children,
}: EntityDetailProps) {
  const visibleFields = fields.filter(
    (field): field is { label: string; value: string } => field.value !== null,
  );

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <article className="grid gap-6 sm:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)]">
        <div className="bg-muted w-full max-w-56 overflow-hidden rounded-xl">
          <EntityImage
            key={imageUrl}
            src={imageUrl}
            alt={`${name}图片`}
            iconClassName="size-10"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{type}</p>
          <HeaderTitle className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {name}
          </HeaderTitle>
          {visibleFields.length > 0 && (
            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {visibleFields.map((field) => (
                <DetailField key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          )}
          <section className="mt-6">
            <h2 className="text-lg font-semibold">简介</h2>
            <div className="text-muted-foreground mt-3 leading-7">
              {summary ? <CollapsibleSummary text={summary} /> : <SummaryEmpty />}
            </div>
          </section>
          <div className="mt-6 flex flex-wrap gap-2">
            <DetailShareButton title={name} />
          </div>
        </div>
      </article>
      {children}
    </div>
  );
}
