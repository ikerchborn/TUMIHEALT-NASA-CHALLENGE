import { Card, EmptyState, PageHeader } from '../components/ui';

export function PhaseStubPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-section">
      <PageHeader eyebrow="Screen placeholder" title={title} subtitle={description} />
      <Card>
        <EmptyState>
          This route is in place. The feature is not implemented yet, and no health assessment is
          generated here.
        </EmptyState>
      </Card>
    </div>
  );
}
