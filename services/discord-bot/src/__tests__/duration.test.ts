import { describe, it, expect } from 'vitest';
import { parseDuration, formatDuration } from '../utils/duration.js';

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('1sec')).toBe(1_000);
    expect(parseDuration('5seconds')).toBe(5_000);
  });

  it('parses minutes', () => {
    expect(parseDuration('20m')).toBe(20 * 60_000);
    expect(parseDuration('1min')).toBe(60_000);
    expect(parseDuration('5minutes')).toBe(5 * 60_000);
  });

  it('parses hours', () => {
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('2hr')).toBe(7_200_000);
    expect(parseDuration('3hours')).toBe(10_800_000);
  });

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86_400_000);
    expect(parseDuration('2day')).toBe(172_800_000);
    expect(parseDuration('3days')).toBe(259_200_000);
  });

  it('parses compound durations', () => {
    expect(parseDuration('1h30m')).toBe(3_600_000 + 30 * 60_000);
    expect(parseDuration('2d12h')).toBe(2 * 86_400_000 + 12 * 3_600_000);
  });

  it('handles whitespace in compound durations', () => {
    expect(parseDuration('1h 30m')).toBe(3_600_000 + 30 * 60_000);
  });

  it('is case insensitive', () => {
    expect(parseDuration('20M')).toBe(20 * 60_000);
    expect(parseDuration('1H')).toBe(3_600_000);
  });

  it('returns null for invalid input', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('hello world')).toBeNull();
  });

  it('returns null for null/undefined-like input', () => {
    expect(parseDuration(null as unknown as string)).toBeNull();
    expect(parseDuration(undefined as unknown as string)).toBeNull();
  });

  it('trims input', () => {
    expect(parseDuration('  20m  ')).toBe(20 * 60_000);
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30_000)).toBe('30s');
  });

  it('formats minutes', () => {
    expect(formatDuration(5 * 60_000)).toBe('5m');
  });

  it('formats hours', () => {
    expect(formatDuration(2 * 3_600_000)).toBe('2h');
  });

  it('formats days', () => {
    expect(formatDuration(3 * 86_400_000)).toBe('3d');
  });

  it('formats compound durations', () => {
    expect(formatDuration(3_600_000 + 30 * 60_000)).toBe('1h 30m');
  });

  it('formats days + hours', () => {
    expect(formatDuration(86_400_000 + 2 * 3_600_000)).toBe('1d 2h');
  });

  it('omits seconds when days are present', () => {
    expect(formatDuration(86_400_000 + 30_000)).toBe('1d');
  });

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});
