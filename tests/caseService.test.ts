import { describe, expect, it } from 'vitest';
import { nextCaseIdFromExisting } from '../src/services/caseService.js';

describe('nextCaseIdFromExisting', () => {
  it('starts at one', () => {
    expect(nextCaseIdFromExisting([])).toBe(1);
  });

  it('uses the next highest case id', () => {
    expect(nextCaseIdFromExisting([2, 9, 4])).toBe(10);
  });
});
