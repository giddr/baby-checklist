'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { ChecklistItem, WeatherData, DailySurvey, TimeBlock } from '@/types';
import { getWeatherEmoji } from '@/lib/weather';
import { likeActivity, unlikeActivity, isActivityLiked } from '@/lib/storage';

interface ChecklistProps {
  items: ChecklistItem[];
  weather: WeatherData | null;
  survey: DailySurvey;
  onToggle: (itemId: string) => void;
  onReorder: (items: ChecklistItem[]) => void;
  onEditSurvey: () => void;
  onStartOver: () => void;
  onOpenFeedback: () => void;
  onRefreshBonusActivity: (itemId: string) => void;
}

type ViewMode = 'timeline' | 'categories';

const timeBlockInfo: Record<TimeBlock, { label: string; emoji: string; timeRange: string }> = {
  morning: { label: 'Morning', emoji: '🌅', timeRange: '6am - 12pm' },
  midday: { label: 'Midday', emoji: '☀️', timeRange: '12pm - 2pm' },
  afternoon: { label: 'Afternoon', emoji: '🌤️', timeRange: '2pm - 5pm' },
  evening: { label: 'Evening', emoji: '🌙', timeRange: '5pm onwards' },
};

// Generate ICS calendar file content
function generateICSContent(items: ChecklistItem[]): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

  const events = items
    .filter(item => item.suggestedTime)
    .map(item => {
      const time = item.suggestedTime!;
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return null;

      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const isPM = match[3].toUpperCase() === 'PM';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;

      const startTime = `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;

      // Add duration based on activity type or default 30 min
      let durationMins = 30;
      if (item.activity?.duration) {
        durationMins = item.activity.duration;
      } else if (item.type === 'nap') {
        durationMins = 30;
      } else if (item.type === 'feeding') {
        durationMins = 30;
      }

      const endHours = hours + Math.floor((minutes + durationMins) / 60);
      const endMinutes = (minutes + durationMins) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}${endMinutes.toString().padStart(2, '0')}00`;

      const uid = `${item.id}-${dateStr}@babydayplanner`;
      const description = item.activity?.description || '';

      return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dateStr}T${startTime}Z
DTSTART:${dateStr}T${startTime}
DTEND:${dateStr}T${endTime}
SUMMARY:${item.task}
DESCRIPTION:${description}
END:VEVENT`;
    })
    .filter(Boolean)
    .join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Baby Day Planner//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Baby Day Plan
${events}
END:VCALENDAR`;
}

// Generate Google Calendar URL for a single event
function generateGoogleCalendarUrl(item: ChecklistItem): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

  if (!item.suggestedTime) return '';

  const match = item.suggestedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '';

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const isPM = match[3].toUpperCase() === 'PM';
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;

  const startTime = `${dateStr}T${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;

  let durationMins = 30;
  if (item.activity?.duration) {
    durationMins = item.activity.duration;
  }

  const endHours = hours + Math.floor((minutes + durationMins) / 60);
  const endMinutes = (minutes + durationMins) % 60;
  const endTime = `${dateStr}T${endHours.toString().padStart(2, '0')}${endMinutes.toString().padStart(2, '0')}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.task,
    dates: `${startTime}/${endTime}`,
    details: item.activity?.description || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Generate Google Calendar URL for all events
function generateGoogleCalendarBatchUrl(items: ChecklistItem[]): string {
  // Google Calendar doesn't support batch creation via URL, so we'll create an event for the whole day
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

  const scheduledItems = items.filter(i => i.suggestedTime);
  const details = scheduledItems
    .map(item => `${item.suggestedTime}: ${item.task}`)
    .join('\\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Baby Day Plan',
    dates: `${dateStr}/${dateStr}`,
    details: details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Generate Apple Calendar URL (uses webcal protocol for better iOS handling)
function generateAppleCalendarData(items: ChecklistItem[]): string {
  const content = generateICSContent(items);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

function downloadICS(items: ChecklistItem[]) {
  const content = generateICSContent(items);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `baby-day-plan-${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Check if on iOS
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Check if on Android
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

export default function Checklist({
  items,
  weather,
  survey,
  onToggle,
  onReorder,
  onEditSurvey,
  onStartOver,
  onOpenFeedback,
  onRefreshBonusActivity,
}: ChecklistProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [draggedItem, setDraggedItem] = useState<ChecklistItem | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [editTask, setEditTask] = useState('');
  const [editTime, setEditTime] = useState('');

  // Handle edit item
  const handleEditItem = (item: ChecklistItem) => {
    setEditingItem(item);
    setEditTask(item.task);
    setEditTime(item.suggestedTime || '');
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    const newItems = items.map(item => {
      if (item.id === editingItem.id) {
        // Parse new time to update timeBlock
        const mins = parseTime(editTime);
        let newBlock: TimeBlock = 'morning';
        if (mins >= 720) newBlock = 'midday';
        if (mins >= 840) newBlock = 'afternoon';
        if (mins >= 1020) newBlock = 'evening';

        return {
          ...item,
          task: editTask,
          suggestedTime: editTime,
          timeBlock: newBlock,
          isEdited: true,
        };
      }
      return item;
    });

    // Re-sort by time
    newItems.sort((a, b) => {
      const timeA = a.suggestedTime ? parseTime(a.suggestedTime) : 0;
      const timeB = b.suggestedTime ? parseTime(b.suggestedTime) : 0;
      return timeA - timeB;
    });

    onReorder(newItems);
    setEditingItem(null);
  };

  const handleDeleteItem = () => {
    if (!editingItem) return;
    const newItems = items.filter(item => item.id !== editingItem.id);
    onReorder(newItems);
    setEditingItem(null);
  };

  // Group items by time block for timeline view
  const itemsByTimeBlock: Record<TimeBlock, ChecklistItem[]> = {
    morning: items.filter(i => i.timeBlock === 'morning'),
    midday: items.filter(i => i.timeBlock === 'midday'),
    afternoon: items.filter(i => i.timeBlock === 'afternoon'),
    evening: items.filter(i => i.timeBlock === 'evening'),
  };

  // Group items by type for categories view
  const feedingItems = items.filter(i => i.type === 'feeding');
  const napItems = items.filter(i => i.type === 'nap');
  const recurringItems = items.filter(i => i.type === 'recurring');
  const bonusItems = items.filter(i => i.type === 'bonus');

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const progress = Math.round((completedCount / totalCount) * 100);

  // Format date
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Drag and drop handlers
  const handleDragStart = useCallback((item: ChecklistItem) => {
    setDraggedItem(item);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    setDragOverId(itemId);
  }, []);

  const handleDrop = useCallback((targetItem: ChecklistItem) => {
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null);
      setDragOverId(null);
      return;
    }

    const newItems = [...items];
    const draggedIndex = newItems.findIndex(i => i.id === draggedItem.id);
    const targetIndex = newItems.findIndex(i => i.id === targetItem.id);

    // Remove dragged item and insert at new position
    const [removed] = newItems.splice(draggedIndex, 1);

    // Update the time block of the dragged item to match the target
    removed.timeBlock = targetItem.timeBlock;
    removed.suggestedTime = targetItem.suggestedTime;

    newItems.splice(targetIndex, 0, removed);

    onReorder(newItems);
    setDraggedItem(null);
    setDragOverId(null);
  }, [draggedItem, items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverId(null);
  }, []);

  // Move item up/down within its block (for mobile-friendly reordering)
  const moveItem = useCallback((itemId: string, direction: 'up' | 'down') => {
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = items[itemIndex];
    const blockItems = items.filter(i => i.timeBlock === item.timeBlock);
    const blockIndex = blockItems.findIndex(i => i.id === itemId);

    if (direction === 'up' && blockIndex === 0) return;
    if (direction === 'down' && blockIndex === blockItems.length - 1) return;

    const swapIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
    const swapItem = blockItems[swapIndex];

    const newItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, suggestedTime: swapItem.suggestedTime };
      }
      if (i.id === swapItem.id) {
        return { ...i, suggestedTime: item.suggestedTime };
      }
      return i;
    });

    // Sort by suggested time
    newItems.sort((a, b) => {
      const timeA = a.suggestedTime ? parseTime(a.suggestedTime) : 0;
      const timeB = b.suggestedTime ? parseTime(b.suggestedTime) : 0;
      return timeA - timeB;
    });

    onReorder(newItems);
  }, [items, onReorder]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Today&apos;s Plan</h1>
          <p className="text-gray-600 dark:text-gray-400">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex flex-col items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            title="Export to Calendar"
          >
            <span className="text-xl">📤</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Calendar</span>
          </button>
          <button
            onClick={onStartOver}
            className="flex flex-col items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            title="Start Over"
          >
            <span className="text-xl">🔄</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Restart</span>
          </button>
          <Link
            href="/settings"
            className="flex flex-col items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            title="Settings"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Settings</span>
          </Link>
        </div>
      </div>

      {/* Weather & Progress row */}
      <div className="flex items-center justify-between gap-4">
        {weather && (
          <div className="weather-badge">
            <span>{getWeatherEmoji(weather)}</span>
            <span>{weather.description}</span>
          </div>
        )}

        <div
          className="progress-ring"
          style={{ '--progress': progress } as React.CSSProperties}
        >
          <div className="progress-ring-inner">
            <span className="text-sm">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Context summary */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
          {survey.energyLevel === 'low' ? '😴 Low energy' :
           survey.energyLevel === 'high' ? '⚡ High energy' : '😊 Medium energy'}
        </span>
        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
          {survey.stayingHome ? '🏠 Home day' : '🚗 Out & about'}
        </span>
        {survey.wantsCrafts && (
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
            🎨 Crafts today
          </span>
        )}
        <button
          onClick={onEditSurvey}
          className="px-3 py-1 text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Edit
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          onClick={() => setViewMode('timeline')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'timeline'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          📅 Day Plan
        </button>
        <button
          onClick={() => setViewMode('categories')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'categories'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          📋 By Type
        </button>
      </div>

      {/* Reorder hint */}
      {viewMode === 'timeline' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Drag items or use arrows to reorder
        </p>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {(['morning', 'midday', 'afternoon', 'evening'] as TimeBlock[]).map(block => {
            const blockItems = itemsByTimeBlock[block];
            if (blockItems.length === 0) return null;
            const info = timeBlockInfo[block];
            const blockCompleted = blockItems.filter(i => i.completed).length;

            return (
              <div key={block} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-lg flex items-center gap-2">
                    <span>{info.emoji}</span>
                    <span>{info.label}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {info.timeRange}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                      {blockCompleted}/{blockItems.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {blockItems.map((item, index) => (
                    <TaskItem
                      key={item.id}
                      item={item}
                      onToggle={() => onToggle(item.id)}
                      onEdit={() => handleEditItem(item)}
                      onRefresh={item.type === 'bonus' ? () => onRefreshBonusActivity(item.id) : undefined}
                      showTime
                      showDetails={item.type === 'bonus'}
                      draggable
                      isDragging={draggedItem?.id === item.id}
                      isDragOver={dragOverId === item.id}
                      onDragStart={() => handleDragStart(item)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDrop={() => handleDrop(item)}
                      onDragEnd={handleDragEnd}
                      onMoveUp={index > 0 ? () => moveItem(item.id, 'up') : undefined}
                      onMoveDown={index < blockItems.length - 1 ? () => moveItem(item.id, 'down') : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Categories View (original) */}
      {viewMode === 'categories' && (
        <>
          {/* Feeds & Naps */}
          {(feedingItems.length > 0 || napItems.length > 0) && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span>🍼</span>
                <span>Feeds & Naps</span>
              </h2>
              <div className="space-y-1">
                {feedingItems.map(item => (
                  <TaskItem
                    key={item.id}
                    item={item}
                    onToggle={() => onToggle(item.id)}
                    showTime
                  />
                ))}
                {napItems.map(item => (
                  <TaskItem
                    key={item.id}
                    item={item}
                    onToggle={() => onToggle(item.id)}
                    showTime
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recurring tasks */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <span>📋</span>
              <span>Daily Must-Dos</span>
            </h2>
            <div className="space-y-1">
              {recurringItems.map(item => (
                <TaskItem
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item.id)}
                />
              ))}
            </div>
          </div>

          {/* Bonus activities */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <span>✨</span>
              <span>Bonus Activities</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Picked just for today based on weather & your energy
            </p>
            <div className="space-y-2">
              {bonusItems.map(item => (
                <TaskItem
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item.id)}
                  onRefresh={() => onRefreshBonusActivity(item.id)}
                  showDetails
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Encouragement */}
      {progress === 100 && (
        <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-center py-6">
          <span className="text-4xl mb-2 block">🎉</span>
          <p className="font-semibold text-green-800 dark:text-green-200">
            Amazing! You did everything today!
          </p>
        </div>
      )}

      {progress >= 50 && progress < 100 && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-center py-4">
          <p className="text-blue-800 dark:text-blue-200">
            Great progress! Keep it up! 💪
          </p>
        </div>
      )}

      {/* Export to Calendar button */}
      <button
        onClick={() => setShowExportModal(true)}
        className="w-full py-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
      >
        📅 Add to Calendar
      </button>

      {/* Feedback & Suggestions button */}
      <button
        onClick={onOpenFeedback}
        className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        📝 Give feedback or suggest a place
      </button>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add to Calendar</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Google Calendar - works great on mobile */}
              <a
                href={generateGoogleCalendarBatchUrl(items)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full p-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-400 transition-colors"
                onClick={() => setShowExportModal(false)}
              >
                <span className="text-2xl">📅</span>
                <div className="text-left">
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Opens directly in app on mobile</p>
                </div>
              </a>

              {/* Apple Calendar - data URL works on iOS Safari */}
              {isIOS() && (
                <a
                  href={generateAppleCalendarData(items)}
                  className="flex items-center gap-3 w-full p-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-400 transition-colors"
                  onClick={() => setShowExportModal(false)}
                >
                  <span className="text-2xl">🍎</span>
                  <div className="text-left">
                    <p className="font-medium">Apple Calendar</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Add all events to iOS Calendar</p>
                  </div>
                </a>
              )}

              {/* Download ICS file */}
              <button
                onClick={() => {
                  downloadICS(items);
                  setShowExportModal(false);
                }}
                className="flex items-center gap-3 w-full p-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-indigo-400 transition-colors text-left"
              >
                <span className="text-2xl">📥</span>
                <div>
                  <p className="font-medium">Download .ics file</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Works with any calendar app</p>
                </div>
              </button>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

              {/* Individual events info */}
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {items.filter(i => i.suggestedTime).length} events will be added
              </p>

              {/* Quick preview */}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {items.filter(i => i.suggestedTime).map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm py-1">
                    <span className="text-gray-400 w-16">{item.suggestedTime}</span>
                    <span className="truncate">{item.task}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Activity</h2>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Activity
                </label>
                <input
                  type="text"
                  value={editTask}
                  onChange={(e) => setEditTask(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time
                </label>
                <select
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
                >
                  {/* Generate time options from 6am to 8pm */}
                  {Array.from({ length: 29 }, (_, i) => {
                    const totalMinutes = 360 + i * 30; // Start at 6am (360 mins)
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    const isPM = hours >= 12;
                    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                    const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
                    return (
                      <option key={timeStr} value={timeStr}>
                        {timeStr}
                      </option>
                    );
                  })}
                </select>
              </div>

              {editingItem.activity && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {editingItem.activity.description}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                      {editingItem.activity.duration}min
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                      {editingItem.activity.category}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleDeleteItem}
                  className="px-4 py-3 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to parse time string to minutes
function parseTime(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const isPM = match[3].toUpperCase() === 'PM';
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

interface TaskItemProps {
  item: ChecklistItem;
  onToggle: () => void;
  onEdit?: () => void;
  onRefresh?: () => void;
  showDetails?: boolean;
  showTime?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function TaskItem({
  item,
  onToggle,
  onEdit,
  onRefresh,
  showDetails,
  showTime,
  draggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: TaskItemProps) {
  const [isLiked, setIsLiked] = useState(() =>
    item.activity ? isActivityLiked(item.activity.id) : false
  );

  const handleLike = () => {
    if (!item.activity) return;
    if (isLiked) {
      unlikeActivity(item.activity);
      setIsLiked(false);
    } else {
      likeActivity(item.activity);
      setIsLiked(true);
    }
  };

  const typeEmoji: Record<string, string> = {
    feeding: '🍼',
    nap: '😴',
    recurring: '📋',
    bonus: '✨',
  };

  return (
    <div
      className={`task-item ${item.completed ? 'completed' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-2 ring-indigo-400' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Drag handle and move buttons */}
      {draggable && (
        <div className="flex flex-col items-center mr-2 gap-0.5">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 text-xs"
              title="Move up"
            >
              ▲
            </button>
          )}
          <span className="cursor-grab active:cursor-grabbing text-gray-400 text-sm">⋮⋮</span>
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 text-xs"
              title="Move down"
            >
              ▼
            </button>
          )}
        </div>
      )}

      <input
        type="checkbox"
        checked={item.completed}
        onChange={onToggle}
        className="checkbox-custom mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showTime && item.suggestedTime && (
            <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
              {item.suggestedTime}
            </span>
          )}
          <span className="text-sm">{typeEmoji[item.type]}</span>
          <p className={`task-text ${item.completed ? 'text-gray-400 line-through' : ''}`}>
            {item.task}
          </p>
        </div>
        {showDetails && item.activity && !item.completed && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">
            {item.activity.description}
          </p>
        )}
        {showDetails && item.activity && (
          <div className="flex flex-wrap gap-1 mt-2 ml-6">
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
              {item.activity.category}
            </span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
              {item.activity.indoor ? 'indoor' : 'outdoor'}
            </span>
          </div>
        )}
        {item.isEdited && (
          <span className="text-xs text-indigo-500 ml-6">edited</span>
        )}
      </div>
      {/* Like button for bonus activities */}
      {item.type === 'bonus' && item.activity && (
        <button
          onClick={handleLike}
          className={`ml-1 p-1 transition-colors ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
          title={isLiked ? 'Unlike activity' : 'Like activity (we\'ll suggest more like this)'}
        >
          {isLiked ? '❤️' : '🤍'}
        </button>
      )}
      {onRefresh && !item.completed && (
        <button
          onClick={onRefresh}
          className="ml-1 p-1 text-gray-400 hover:text-indigo-500 transition-colors"
          title="Switch activity"
        >
          🔄
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className="ml-1 p-1 text-gray-400 hover:text-indigo-500 transition-colors"
          title="Edit item"
        >
          ✏️
        </button>
      )}
    </div>
  );
}
