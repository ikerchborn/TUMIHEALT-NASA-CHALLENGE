import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHealthAssistantAnswers } from '@/services';
import type { HealthAssistantAnswer } from '@/services';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';
import { Alert, Button, Card, EmptyState, PageHeader } from '../components/ui';
import { useProfile } from '../context/ProfileContext';

export function HealthAssistantPage() {
  const { active, isDemoMode } = useProfile();
  const [answers, setAnswers] = useState<HealthAssistantAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const profileId = active?.astronaut_id;

  useEffect(() => {
    let cancelled = false;
    if (!profileId) {
      setAnswers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getHealthAssistantAnswers(profileId)
      .then((result) => {
        if (!cancelled) {
          setAnswers(result);
          setError(undefined);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        eyebrow={isDemoMode ? 'DEMO DATA · Rule-based support' : 'Rule-based support'}
        title="Health Assistant"
        subtitle="Plain-language observations based only on this profile’s imported records and self-reported check-ins."
        primaryAction={
          <Button type="button" onClick={() => setReviewOpen(true)}>
            Request medical review
          </Button>
        }
      />

      <Alert kind="info">
        Educational information, not a diagnosis. Follow your mission medical protocols. This assistant uses deterministic local rules and makes no external calls.
      </Alert>
      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-400">Reviewing this profile’s local records…</p>}
      {!loading && !error && !profileId && <EmptyState>Select a profile to review its records.</EmptyState>}
      {!loading && !error && profileId && (
        <div className="space-y-4">
          {answers.map((answer) => (
            <Card key={answer.id} title={answer.question}>
              <p className="text-base leading-relaxed text-slate-100">{answer.observation}</p>
              {answer.evidence.length > 0 && (
                <ul className="mt-4 space-y-2 border-l-2 border-cyan-700 pl-4" aria-label="Supporting records and dates">
                  {answer.evidence.map((item, index) => (
                    <li key={`${item.label}-${item.date}-${index}`} className="text-sm text-slate-300">
                      <span className="font-medium text-white">{item.label}</span>
                      <span className="ml-2 text-slate-400">{item.date}</span>
                    </li>
                  ))}
                </ul>
              )}
              {answer.educational_context && (
                <p className="mt-4 rounded-control border border-slate-700 bg-mission-canvas p-3 text-sm leading-relaxed text-slate-300">
                  Educational space-health context: {answer.educational_context}{' '}
                  <Link to="/hazards" className="text-cyan-200 underline">Review space health risks</Link>
                </p>
              )}
              <p className="mt-4 text-sm leading-relaxed text-cyan-100">
                <span className="font-semibold">Suggested next step:</span> {answer.next_step}
              </p>
              {answer.id === 'missing' && (
                <Link
                  to="/import"
                  className="mt-4 inline-flex min-h-11 items-center rounded-control border border-cyan-700 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  Import data
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card title="Need to share a concern?">
        <p className="text-sm leading-relaxed text-slate-300">
          You can select records and check-ins for a local medical review request. The app does not contact a medical team.
        </p>
        <Button type="button" variant="ghost" className="mt-4" onClick={() => setReviewOpen(true)}>
          Create local review request
        </Button>
      </Card>

      <MedicalReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        profileId={profileId}
        isDemoMode={isDemoMode}
      />
    </div>
  );
}
