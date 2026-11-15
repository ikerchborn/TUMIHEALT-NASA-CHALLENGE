import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { DemoBanner, DisclaimerBanner, Icon, type IconName } from '../components/ui';

interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: IconName;
  end?: boolean;
  children?: { to: string; label: string }[];
}

const primaryItems: NavItem[] = [
  { to: '/', label: 'Mission Home', shortLabel: 'Home', icon: 'home', end: true },
  { to: '/check-in', label: 'Daily Check-in', shortLabel: 'Check-in', icon: 'check-in' },
  { to: '/import', label: 'My Measurements', shortLabel: 'Data', icon: 'measurements' },
  { to: '/trends', label: 'My Health Trends', shortLabel: 'Trends', icon: 'trends' },
  { to: '/body', label: 'Body Explorer', shortLabel: 'Body', icon: 'body' },
];

const secondaryItems: NavItem[] = [
  { to: '/assistant', label: 'Health Assistant', icon: 'assistant' },
  {
    to: '/guides',
    label: 'Health Guides',
    icon: 'guides',
    children: [{ to: '/hazards', label: 'Space Health Risks' }],
  },
  { to: '/research', label: 'NASA Research', icon: 'research' },
  { to: '/profiles', label: 'Mission & Privacy', icon: 'privacy' },
];

function NavigationLink({
  item,
  onNavigate,
  compact = false,
}: {
  item: NavItem;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={compact ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-control border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
          isActive
            ? 'border-cyan-500/45 bg-cyan-950/65 text-cyan-100'
            : 'border-transparent text-slate-300 hover:bg-mission-surface-raised hover:text-white'
        } ${compact ? 'flex-col gap-1 border-0 px-1 py-2 text-sm' : ''}`
      }
    >
      <Icon name={item.icon} className={compact ? 'h-5 w-5' : 'h-5 w-5 shrink-0'} />
      <span className={compact ? 'max-w-full truncate' : ''}>
        {compact ? item.shortLabel ?? item.label : item.label}
      </span>
    </NavLink>
  );
}

function NavigationList({
  items,
  onNavigate,
  compact = false,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'}>
      {items.map((item) => (
        <div key={item.to}>
          <NavigationLink item={item} onNavigate={onNavigate} />
          {item.children?.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `ml-11 mt-1 flex items-center rounded-control px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
                  isActive ? 'text-cyan-100' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const { profiles, active, isDemoMode, selectProfile, exitDemoMode } = useProfile();
  const [moreOpen, setMoreOpen] = useState(false);

  async function handleExitDemo() {
    const remainingId = await exitDemoMode();
    if (!remainingId) {
      navigate('/welcome', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-mission-canvas text-slate-100">
      <DisclaimerBanner />
      {isDemoMode && <DemoBanner onExit={() => void handleExitDemo()} />}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-mission-border bg-mission-canvas/95 p-5 md:flex">
          <Link to="/" className="mb-8 flex items-center gap-3 rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent">
            <span className="grid h-11 w-11 place-items-center rounded-control border border-cyan-500/35 bg-cyan-500/10 text-cyan-200">
              <Icon name="body" className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-wide text-white">TUMI-HEALT</span>
              <span className="block text-sm text-slate-400">Astronaut health</span>
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto">
            <p className="mb-2 px-3 text-sm font-semibold text-slate-400">Your health</p>
            <NavigationList items={primaryItems} />
          </nav>

          <nav aria-label="Secondary navigation" className="mt-6 border-t border-mission-border pt-5">
            <p className="mb-2 px-3 text-sm font-semibold text-slate-400">Explore & manage</p>
            <NavigationList items={secondaryItems} />
          </nav>

          <p className="mt-5 border-t border-mission-border pt-4 text-xs leading-relaxed text-slate-400">
            Local-first browser storage. Profile selection is not authentication.
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-mission-border bg-mission-canvas/95 px-page py-3 backdrop-blur sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="text-sm font-semibold tracking-wide text-white md:hidden"
                >
                  TUMI-HEALT
                </Link>
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="secondary-mobile-navigation"
                  onClick={() => setMoreOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-control border border-mission-border px-3 py-2 text-sm text-slate-200 hover:bg-mission-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent md:hidden"
                >
                  <Icon name={moreOpen ? 'close' : 'more'} className="h-4 w-4" />
                  More
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <Link
                  to="/import"
                  className="inline-flex items-center gap-2 rounded-control bg-mission-accent-strong px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent sm:px-4"
                >
                  <Icon name="upload" className="h-4 w-4" />
                  <span>+ Import data</span>
                </Link>
                <label htmlFor="active-astronaut-select" className="sr-only">
                  Active profile
                </label>
                <select
                  id="active-astronaut-select"
                  value={active?.astronaut_id ?? ''}
                  onChange={(event) => selectProfile(event.target.value)}
                  disabled={profiles.length === 0}
                  className="max-w-36 rounded-control border border-mission-border bg-mission-surface-raised px-2.5 py-2 text-sm text-slate-100 focus:border-mission-accent focus:outline-none focus:ring-2 focus:ring-cyan-500/25 sm:max-w-52 sm:px-3"
                >
                  {profiles.length === 0 && <option value="">No profiles</option>}
                  {profiles.map((profile) => (
                    <option key={profile.astronaut_id} value={profile.astronaut_id}>
                      {profile.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {moreOpen && (
              <nav
                id="secondary-mobile-navigation"
                aria-label="More navigation"
                className="mt-3 border-t border-mission-border pt-3 md:hidden"
              >
                <NavigationList
                  items={secondaryItems}
                  compact
                  onNavigate={() => setMoreOpen(false)}
                />
              </nav>
            )}
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-page py-5 pb-24 sm:px-6 sm:py-7 md:pb-8 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-mission-border bg-mission-canvas/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-panel backdrop-blur md:hidden"
      >
        {primaryItems.map((item) => (
          <NavigationLink
            key={item.to}
            item={item}
            compact
            onNavigate={() => setMoreOpen(false)}
          />
        ))}
      </nav>
    </div>
  );
}
