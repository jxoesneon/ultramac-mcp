/**
 * UltraMac MCP
 * (c) 2025 UltraMac MCP Authors
 * This source code is licensed under the ISC license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import { MCPServer } from "../server/mcp-server";
import { actionLogger } from "../core/action-logger";
import { getMetrics } from "../core/metrics";

/**
 * Register administrative & monitoring tools
 */
export function registerAdminTools(server: MCPServer) {
  
  server.addTool({
    name: 'metrics',
    description: 'Get Prometheus metrics for monitoring.',
    parameters: z.object({}),
    execute: async () => {
      return await getMetrics();
    }
  });

  server.addTool({
    name: 'get_action_history',
    description: 'Get the history of automation actions.',
    parameters: z.object({
      limit: z.number().optional()
    }),
    execute: async ({ limit }: {limit?: number}) => {
      const history = actionLogger.getHistory(limit);
      return JSON.stringify({
        count: history.length,
        actions: history.map(r => ({
          id: r.id,
          timestamp: new Date(r.timestamp).toISOString(),
          tool: r.tool,
          args: r.args,
          success: r.success,
          duration: `${r.duration}ms`,
          result: typeof r.result === 'string' ? r.result.substring(0, 200) : r.result
        }))
      }, null, 2);
    }
  });

  server.addTool({
    name: 'replay_action',
    description: 'Replay a previous action by its ID.',
    parameters: z.object({
      id: z.string()
    }),
    execute: async ({ id }: {id: string}) => {
      const record = actionLogger.getById(id);
      if (!record) return `Action record "${id}" not found.`;
      
      const registry = server.getRegistry();
      const tool = registry.get(record.tool);
      if (!tool) return `Tool "${record.tool}" is not registered.`;
      
      const result = await tool.execute(record.args, {});
      return `Replay Result: ${JSON.stringify(result, null, 2)}`;
    }
  });

  server.addTool({
    name: 'clear_action_history',
    description: 'Clear all action history.',
    parameters: z.object({}),
    execute: async () => {
      actionLogger.clear();
      return 'Action history cleared.';
    }
  });
}
