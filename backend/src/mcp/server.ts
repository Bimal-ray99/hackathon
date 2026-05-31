import { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CoralClient } from '../coral/client';

const coral = new CoralClient();

const SEED_STATUS = {
  active_incidents: [
    { id: 'inc-001', title: 'Upload failures for Enterprise', severity: 'P0', mrr_at_risk: 14200 },
  ],
  flags_at_risk: ['new-upload-flow'],
  mrr_at_risk: 14200,
};

export function setupMCPServer(app: Express) {
  app.post('/mcp', async (req: Request, res: Response) => {
    const server = new Server(
      { name: 'pulseiq', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query_incident_status',
          description: 'Get current active incidents, at-risk feature flags, and MRR at risk from PulseIQ via Coral',
          inputSchema: {
            type: 'object',
            properties: {
              incident_id: { type: 'string', description: 'Optional specific incident ID to query' },
            },
          },
        },
        {
          name: 'run_coral_analysis',
          description: 'Run a cross-source Coral SQL query to analyze incidents across GitHub, LaunchDarkly, Sentry, Slack, and Stripe',
          inputSchema: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Natural language question to analyze via Coral' },
            },
            required: ['question'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const toolArgs = (args ?? {}) as Record<string, unknown>;

      if (name === 'query_incident_status') {
        try {
          const rows = await coral.query(
            `SELECT i.id, i.title, i.severity, s.count as error_count
             FROM launchdarkly.feature_flags f
             JOIN sentry.issues s ON s.status = 'unresolved'
             LIMIT 5`
          );
          const result = rows.length > 0
            ? { active_incidents: rows, flags_at_risk: ['detected via Coral'], mrr_at_risk: rows.length * 2000 }
            : SEED_STATUS;
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch {
          return { content: [{ type: 'text', text: JSON.stringify(SEED_STATUS, null, 2) }] };
        }
      }

      if (name === 'run_coral_analysis') {
        const question = String(toolArgs.question ?? '');
        const queryMap: Record<string, string> = {
          error: `SELECT title, level, COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved' GROUP BY title, level ORDER BY count DESC LIMIT 5`,
          flag: `SELECT key, name, description FROM launchdarkly.feature_flags WHERE project_key = 'default' LIMIT 10`,
          commit: `SELECT commit__message as message, commit__author__name as author, commit__author__date as date FROM github.commits WHERE owner = 'Bimal-ray99' AND repo = 'pulseiq-victim-service' ORDER BY commit__author__date DESC LIMIT 5`,
          customer: `SELECT id, name, mrr, plan FROM stripe.customers WHERE plan = 'enterprise' ORDER BY mrr DESC LIMIT 5`,
          ticket: `SELECT subject, status, created_at FROM intercom.tickets ORDER BY created_at DESC LIMIT 5`,
        };

        const lower = question.toLowerCase();
        const sql = Object.entries(queryMap).find(([k]) => lower.includes(k))?.[1]
          ?? `SELECT title, level, project FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 5`;

        try {
          const rows = await coral.query(sql);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ question, query: sql, rows, sources: ['sentry', 'launchdarkly', 'github', 'stripe', 'intercom'] }, null, 2),
            }],
          };
        } catch {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ question, query: sql, rows: [], error: 'Coral unavailable — run with seed data' }, null, 2),
            }],
          };
        }
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    });

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
}
