import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionLogger } from '../../src/core/action-logger';
import { z } from 'zod';

// We need to mock ActionLogger because the global instance in index.ts is hard to access for replacement
// In a real test, we might export the tools themselves for testing without starting the server
describe('Tool Integration: Action History', () => {
  let actionLogger: ActionLogger;

  beforeEach(() => {
    actionLogger = new ActionLogger(':memory:');
  });

  it('delete_action_record should remove record from logger', async () => {
    // Manually log an action
    const record = actionLogger.log('test-tool', {}, 'success', 100, true);
    expect(actionLogger.getHistory().length).toBe(1);

    // Simulate the tool execution logic
    const toolExecute = async ({ id }: { id: string }) => {
      const success = actionLogger.removeRecord(id);
      return success ? `Action record "${id}" deleted.` : `Action record "${id}" not found.`;
    };

    const result = await toolExecute({ id: record.id });
    expect(result).toContain('deleted');
    expect(actionLogger.getHistory().length).toBe(0);
  });

  it('delete_action_record should return not found for invalid ID', async () => {
    const toolExecute = async ({ id }: { id: string }) => {
      const success = actionLogger.removeRecord(id);
      return success ? `Action record "${id}" deleted.` : `Action record "${id}" not found.`;
    };

    const result = await toolExecute({ id: 'non-existent' });
    expect(result).toContain('not found');
  });
});
