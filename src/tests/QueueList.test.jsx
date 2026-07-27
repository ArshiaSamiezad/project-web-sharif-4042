import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QueueList from '../components/player/QueueList';

vi.mock('../utils/normalizeTrack', () => ({
  normalizeTrack: (track) =>
    typeof track === 'object' && track !== null
      ? track
      : { id: track, title: `Track ${track}`, artistName: 'Artist', coverImage: 'img.jpg' },
}));

vi.mock('../i18n/I18nProvider', () => {
  const translations = {
    'player.remove': 'حذف',
    'player.removeFromQueue': 'حذف',
    'player.delete': 'حذف',
    'queue.remove': 'حذف',
  };

  return {
    useI18n: () => ({
      t: (key, options) => {
        if (options && options.count !== undefined) {
          return `${options.count} آهنگ`;
        }
        if (translations[key]) {
          return translations[key];
        }
        if (typeof key === 'string' && (key.includes('remove') || key.includes('delete'))) {
          return 'حذف';
        }
        if (typeof key === 'string' && (key.includes('count') || key.includes('tracks'))) {
          return '۲ آهنگ';
        }
        return key;
      },
      locale: 'fa',
    }),
  };
});

describe('QueueList Component (Original Code)', () => {
  it('returns null if isOpen is false or queue is empty', () => {
    const { container: c1 } = render(<QueueList isOpen={false} queue={[{ id: '1' }]} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<QueueList isOpen={true} queue={[]} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders queue items with titles and artist names when open', () => {
    const mockQueue = [
      { id: '1', title: 'آهنگ اول', artistName: 'خواننده ۱', coverImage: 'cover1.jpg' },
      { id: '2', title: 'آهنگ دوم', artistName: 'خواننده ۲', coverImage: 'cover2.jpg' },
    ];

    render(<QueueList isOpen={true} queue={mockQueue} />);

    expect(screen.getByText('آهنگ اول')).toBeInTheDocument();
    expect(screen.getByText('خواننده ۱')).toBeInTheDocument();
    expect(screen.getByText('آهنگ دوم')).toBeInTheDocument();

    expect(screen.getByText(/[2۲]\s*آهنگ/)).toBeInTheDocument();
  });

  it('calls onClose when clicking on backdrop', () => {
    const mockClose = vi.fn();
    const mockQueue = [{ id: '1', title: 'Song 1' }];

    const { container } = render(<QueueList isOpen={true} queue={mockQueue} onClose={mockClose} />);
    const backdrop = container.querySelector('.queue-list__backdrop');

    fireEvent.click(backdrop);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with correct index when clicking trash button', () => {
    const mockRemove = vi.fn();
    const mockQueue = [
      { id: '1', title: 'Track 1' },
      { id: '2', title: 'Track 2' },
    ];

    render(<QueueList isOpen={true} queue={mockQueue} onRemove={mockRemove} />);

    const removeButtons = screen.getAllByRole('button', { name: /حذف/i });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]);
    expect(mockRemove).toHaveBeenCalledWith(1);
  });
});