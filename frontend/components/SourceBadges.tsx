'use client';

import { SiGithub, SiSentry, SiSlack, SiStripe, SiIntercom } from 'react-icons/si';
import { TbFlag } from 'react-icons/tb';

const SOURCE_STYLE: Record<string, { bg: string; icon: React.ReactNode }> = {
  github:       { bg: 'bg-slate-800 text-slate-100',    icon: <SiGithub className="w-3 h-3" /> },
  launchdarkly: { bg: 'bg-blue-600 text-white',          icon: <TbFlag className="w-3 h-3" /> },
  sentry:       { bg: 'bg-red-600 text-white',           icon: <SiSentry className="w-3 h-3" /> },
  slack:        { bg: 'bg-purple-600 text-white',        icon: <SiSlack className="w-3 h-3" /> },
  stripe:       { bg: 'bg-indigo-600 text-white',        icon: <SiStripe className="w-3 h-3" /> },
  intercom:     { bg: 'bg-orange-500 text-white',        icon: <SiIntercom className="w-3 h-3" /> },
};

interface SourceBadgesProps {
  sources: string[];
}

export function SourceBadges({ sources }: SourceBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map(source => {
        const style = SOURCE_STYLE[source];
        return (
          <span
            key={source}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${style?.bg || 'bg-slate-200 text-slate-700'}`}
          >
            {style?.icon}
            {source}
          </span>
        );
      })}
    </div>
  );
}
