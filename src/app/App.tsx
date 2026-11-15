import { useEffect, useState } from 'react';
import { initializeDatabase } from '@/services';

/**
 * Minimal application shell for build verification and local database initialization.
 * The full dashboard UI is developed separately by the frontend team member.
 */
export function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    void initializeDatabase().then(() => setDbReady(true));
  }, []);

  return (
    <main>
      <h1>TUMI-HEALT — Core Data Layer</h1>
      <p>Local IndexedDB status: {dbReady ? 'Ready' : 'Initializing...'}</p>
    </main>
  );
}
