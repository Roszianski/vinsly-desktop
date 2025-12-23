import React from 'react';

interface ReleaseNotesProps {
  notes: string;
  maxItems?: number;
}

/**
 * Parses release notes and extracts bullet points.
 * Supports markdown-style bullets (-, *, +) and numbered lists.
 */
function parseReleaseNotes(notes: string): string[] {
  const lines = notes.split('\n');
  const bulletPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match markdown bullets (-, *, +) or numbered lists (1., 2., etc.)
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      bulletPoints.push(bulletMatch[1].trim());
    }
  }

  return bulletPoints;
}

export const ReleaseNotes: React.FC<ReleaseNotesProps> = ({ notes, maxItems = 5 }) => {
  const bulletPoints = parseReleaseNotes(notes);

  if (bulletPoints.length === 0) {
    return null;
  }

  const displayItems = bulletPoints.slice(0, maxItems);
  const hasMore = bulletPoints.length > maxItems;

  return (
    <ul className="space-y-1.5">
      {displayItems.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-sm text-v-light-text-primary dark:text-v-text-primary">
          <span className="text-v-accent mt-1 flex-shrink-0">
            <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
              <circle cx="3" cy="3" r="3" />
            </svg>
          </span>
          <span>{item}</span>
        </li>
      ))}
      {hasMore && (
        <li className="text-xs text-v-light-text-secondary dark:text-v-text-secondary pl-4">
          +{bulletPoints.length - maxItems} more...
        </li>
      )}
    </ul>
  );
};

export default ReleaseNotes;
