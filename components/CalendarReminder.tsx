'use client';

import { dismissCalendarReminder } from '@/lib/storage';

interface CalendarReminderProps {
  onDismiss: () => void;
}

export default function CalendarReminder({ onDismiss }: CalendarReminderProps) {
  const handleResponse = (response: 'yes' | 'no' | 'later') => {
    dismissCalendarReminder(response);
    onDismiss();

    if (response === 'yes') {
      // For now, just log - in v2 this would trigger OAuth flow
      console.log('User wants calendar sync - feature coming in v2!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card max-w-sm w-full">
        <div className="text-center mb-4">
          <span className="text-4xl block mb-2">📅</span>
          <h2 className="text-xl font-semibold mb-2">
            Quick question!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You&apos;ve been using the app for a month now! Would it be helpful to sync your Google Calendar so the app can automatically see your appointments?
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handleResponse('yes')}
            className="btn btn-primary w-full"
          >
            Yes, that would help!
          </button>
          <button
            onClick={() => handleResponse('later')}
            className="btn btn-secondary w-full"
          >
            Maybe later
          </button>
          <button
            onClick={() => handleResponse('no')}
            className="text-gray-500 dark:text-gray-400 w-full py-2 text-sm hover:underline"
          >
            No thanks, I prefer typing it
          </button>
        </div>
      </div>
    </div>
  );
}
