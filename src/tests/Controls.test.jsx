import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Controls from '../components/player/Controls';

describe('Controls Component (Original Code)', () => {
  it('renders all 5 control buttons', () => {
    render(<Controls isPlaying={false} shuffle={false} repeat={0} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('triggers onToggleShuffle and checks "is-active" class when shuffle is true', () => {
    const mockShuffle = vi.fn();
    render(<Controls shuffle={true} onToggleShuffle={mockShuffle} />);

    const shuffleBtn = screen.getByRole('button', { name: 'پخش تصادفی' });
    expect(shuffleBtn.className).toContain('is-active');

    fireEvent.click(shuffleBtn);
    expect(mockShuffle).toHaveBeenCalledTimes(1);
  });

  it('triggers onPrev, onTogglePlay, and onNext callbacks', () => {
    const mockPrev = vi.fn();
    const mockPlay = vi.fn();
    const mockNext = vi.fn();

    render(
      <Controls
        isPlaying={false}
        onPrev={mockPrev}
        onTogglePlay={mockPlay}
        onNext={mockNext}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'آهنگ قبلی' }));
    expect(mockPrev).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'پخش' }));
    expect(mockPlay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'آهنگ بعدی' }));
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('changes play/pause button label based on isPlaying state', () => {
    const { rerender } = render(<Controls isPlaying={false} />);
    expect(screen.getByRole('button', { name: 'پخش' })).toBeInTheDocument();

    rerender(<Controls isPlaying={true} />);
    expect(screen.getByRole('button', { name: 'توقف پخش' })).toBeInTheDocument();
  });

  it('handles repeat button state and displays badge when repeat === 2', () => {
    const mockRepeat = vi.fn();
    render(<Controls repeat={2} onCycleRepeat={mockRepeat} />);

    const repeatBtn = screen.getByRole('button', { name: 'حالت تکرار' });
    expect(repeatBtn.className).toContain('is-active');
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(repeatBtn);
    expect(mockRepeat).toHaveBeenCalledTimes(1);
  });
});