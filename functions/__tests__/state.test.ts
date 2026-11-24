import { describe, expect, it } from 'vitest';
import { nextMonitorState } from '../lib/state';

describe('nextMonitorState (2-strike incident rule)', () => {
  it('does not open an incident on the first down check', () => {
    const step1 = nextMonitorState(null, 'down', 10);
    expect(step1.transition).toBeNull();
    expect(step1.next.consecutiveFail).toBe(1);
    expect(step1.next.openIncidentId).toBeNull();
  });

  it('opens an incident on 2 consecutive down checks', () => {
    const step1 = nextMonitorState(null, 'down', 10);
    const step2 = nextMonitorState(step1.next, 'down', 10);
    expect(step2.transition).toBe('incident_opened');
    expect(step2.next.consecutiveFail).toBe(2);
    expect(step2.next.openIncidentId).toBe(10);
  });

  it('resets fail count on a single recovery without flapping', () => {
    const step1 = nextMonitorState(null, 'down', 10);
    const step2 = nextMonitorState(step1.next, 'up', 10);
    expect(step2.transition).toBeNull();
    expect(step2.next.consecutiveFail).toBe(0);
    expect(step2.next.consecutiveOk).toBe(1);
    expect(step2.next.openIncidentId).toBeNull();
  });

  it('resolves an open incident only after 2 consecutive non-down checks', () => {
    const s1 = nextMonitorState(null, 'down', 42);
    const s2 = nextMonitorState(s1.next, 'down', 42);
    expect(s2.next.openIncidentId).toBe(42);

    const r1 = nextMonitorState(s2.next, 'degraded', 42);
    expect(r1.transition).toBeNull();
    expect(r1.next.openIncidentId).toBe(42);

    const r2 = nextMonitorState(r1.next, 'up', 42);
    expect(r2.transition).toBe('incident_resolved');
    expect(r2.next.openIncidentId).toBeNull();
  });
});
