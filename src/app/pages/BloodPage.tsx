import { CategoryHistoryPage } from './CategoryHistoryPage';

export function BloodPage() {
  return (
    <CategoryHistoryPage
      category="blood"
      title="Blood Health"
      subtitle="Review blood biomarkers from imported health records."
      spaceContext="Blood markers such as hemoglobin, blood-cell counts, and metabolic indicators can change with fluid shifts, hydration, nutrition, and other mission conditions."
    />
  );
}
