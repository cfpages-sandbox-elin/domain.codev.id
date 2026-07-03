import { describe, expect, it } from 'vitest';
import { getTagForSubmitShortcut } from './bulkAddLogic';

describe('Add Domains shortcut tag selection', () => {
  it('maps unmodified, Shift, and Alt submit shortcuts', () => {
    expect(getTagForSubmitShortcut({ shiftKey: false, altKey: false })).toBe('mine');
    expect(getTagForSubmitShortcut({ shiftKey: true, altKey: false })).toBe('to-snatch');
    expect(getTagForSubmitShortcut({ shiftKey: false, altKey: true })).toBe('others');
  });

  it('gives the explicit Others modifier precedence', () => {
    expect(getTagForSubmitShortcut({ shiftKey: true, altKey: true })).toBe('others');
  });
});
