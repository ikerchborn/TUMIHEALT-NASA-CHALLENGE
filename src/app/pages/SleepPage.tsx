import { CategoryHistoryPage } from './CategoryHistoryPage';

export function SleepPage() {
  return (
    <CategoryHistoryPage
      category="sleep"
      title="Sleep and Recovery"
      subtitle="Review sleep duration and other sleep indicators from imported records."
      spaceContext="Circadian shifts, workload, light, noise, and confinement can affect sleep during a mission. Ground-analog studies are not the same as in-flight measurements."
    />
  );
}
