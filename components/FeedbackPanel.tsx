'use client';

import { useState } from 'react';
import { saveFeedback, addVenueSuggestion, getTodayFeedback } from '@/lib/storage';
import type { DailyFeedback } from '@/types';

interface FeedbackPanelProps {
  completedActivities: string[];
  onClose: () => void;
}

export default function FeedbackPanel({ completedActivities, onClose }: FeedbackPanelProps) {
  const existingFeedback = getTodayFeedback();
  const [activeTab, setActiveTab] = useState<'feedback' | 'suggest'>('feedback');
  const [whatWorked, setWhatWorked] = useState<string[]>(existingFeedback?.whatWorked || []);
  const [whatDidntWork, setWhatDidntWork] = useState<string[]>(existingFeedback?.whatDidntWork || []);
  const [notes, setNotes] = useState(existingFeedback?.notes || '');
  const [saved, setSaved] = useState(false);

  // Venue suggestion state
  const [venueName, setVenueName] = useState('');
  const [venueType, setVenueType] = useState('');
  const [venueArea, setVenueArea] = useState('');
  const [venueNotes, setVenueNotes] = useState('');
  const [suggestionSaved, setSuggestionSaved] = useState(false);

  const handleSaveFeedback = () => {
    const feedback: DailyFeedback = {
      date: new Date().toISOString().split('T')[0],
      whatWorked,
      whatDidntWork,
      notes,
    };
    saveFeedback(feedback);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveSuggestion = () => {
    if (!venueName.trim()) return;

    addVenueSuggestion({
      name: venueName.trim(),
      type: venueType || 'other',
      area: venueArea.trim(),
      notes: venueNotes.trim(),
    });

    setSuggestionSaved(true);
    setVenueName('');
    setVenueType('');
    setVenueArea('');
    setVenueNotes('');
    setTimeout(() => setSuggestionSaved(false), 2000);
  };

  const toggleActivity = (activity: string, list: 'worked' | 'didnt') => {
    if (list === 'worked') {
      if (whatWorked.includes(activity)) {
        setWhatWorked(whatWorked.filter(a => a !== activity));
      } else {
        setWhatWorked([...whatWorked, activity]);
        // Remove from didn't work if it's there
        setWhatDidntWork(whatDidntWork.filter(a => a !== activity));
      }
    } else {
      if (whatDidntWork.includes(activity)) {
        setWhatDidntWork(whatDidntWork.filter(a => a !== activity));
      } else {
        setWhatDidntWork([...whatDidntWork, activity]);
        // Remove from worked if it's there
        setWhatWorked(whatWorked.filter(a => a !== activity));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {activeTab === 'feedback' ? '📝 End of Day Feedback' : '📍 Suggest a Place'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'feedback'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            }`}
          >
            Daily Feedback
          </button>
          <button
            onClick={() => setActiveTab('suggest')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'suggest'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            }`}
          >
            Suggest a Venue
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              {/* What worked */}
              <div>
                <h3 className="font-medium mb-2 text-green-700 dark:text-green-400">
                  ✓ What worked well today?
                </h3>
                <div className="flex flex-wrap gap-2">
                  {completedActivities.map(activity => (
                    <button
                      key={`worked-${activity}`}
                      onClick={() => toggleActivity(activity, 'worked')}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        whatWorked.includes(activity)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-500'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {activity}
                    </button>
                  ))}
                </div>
              </div>

              {/* What didn't work */}
              <div>
                <h3 className="font-medium mb-2 text-orange-700 dark:text-orange-400">
                  ✗ What didn&apos;t work or was too hard?
                </h3>
                <div className="flex flex-wrap gap-2">
                  {completedActivities.map(activity => (
                    <button
                      key={`didnt-${activity}`}
                      onClick={() => toggleActivity(activity, 'didnt')}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        whatDidntWork.includes(activity)
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-2 border-orange-500'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {activity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="font-medium mb-2">💭 Notes for next time</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any thoughts, what baby enjoyed, what to try differently..."
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl resize-none h-24 focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                />
              </div>

              <button
                onClick={handleSaveFeedback}
                className="btn btn-primary w-full"
              >
                {saved ? '✓ Saved!' : 'Save Feedback'}
              </button>
            </div>
          )}

          {activeTab === 'suggest' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Know a great baby-friendly spot in Melbourne? Add it here!
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">Place name *</label>
                <input
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g., Northcote Library"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                >
                  <option value="">Select type...</option>
                  <option value="library">Library</option>
                  <option value="park">Park / Playground</option>
                  <option value="museum">Museum / Gallery</option>
                  <option value="cafe">Cafe</option>
                  <option value="playcentre">Play Centre</option>
                  <option value="beach">Beach</option>
                  <option value="market">Market</option>
                  <option value="zoo">Zoo / Farm</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Area/Suburb</label>
                <input
                  type="text"
                  value={venueArea}
                  onChange={(e) => setVenueArea(e.target.value)}
                  placeholder="e.g., Northcote, CBD, St Kilda"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Why is it good for babies?</label>
                <textarea
                  value={venueNotes}
                  onChange={(e) => setVenueNotes(e.target.value)}
                  placeholder="e.g., Great baby rhyme time, good change facilities, pram friendly..."
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl resize-none h-20 focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                />
              </div>

              <button
                onClick={handleSaveSuggestion}
                disabled={!venueName.trim()}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {suggestionSaved ? '✓ Added!' : 'Add Suggestion'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Suggestions are saved locally. We&apos;ll review and add the best ones!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
