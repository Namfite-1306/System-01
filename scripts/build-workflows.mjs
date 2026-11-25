import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('../workflows/', import.meta.url);
await mkdir(dir, { recursive: true });
const http = (id, name, path, x) => ({
  id,
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [x, 300],
  parameters: {
    method: 'POST',
    url: `http://studio:4318/api/${path}`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody:
      path === 'cases'
        ? '={{ JSON.stringify({event_id: $json.body.event_id, mode: $json.body.mode || "template"}) }}'
        : '{}',
    options: { timeout: 30000 },
  },
  notes:
    'Select Header Auth credential: Authorization = Bearer <STUDIO_API_TOKEN>. Do not put the token into workflow JSON.',
});
const schedule = {
  name: 'Research Studio — Collect RSS hourly',
  nodes: [
    {
      id: 'schedule',
      name: 'Every hour',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [260, 300],
      parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
    },
    http('ingest', 'Start RSS job', 'ingest', 520),
  ],
  connections: { 'Every hour': { main: [[{ node: 'Start RSS job', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1', timezone: 'Asia/Ho_Chi_Minh' },
  active: false,
  pinData: {},
  meta: { templateCredsSetupCompleted: false },
};
const cases = {
  name: 'Research Studio — Create case API',
  nodes: [
    {
      id: 'webhook',
      name: 'Authenticated case request',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [260, 300],
      parameters: {
        httpMethod: 'POST',
        path: 'research-case',
        authentication: 'headerAuth',
        responseMode: 'responseNode',
        options: {},
      },
      notes: 'Configure separate inbound Header Auth; this webhook is private.',
    },
    http('case', 'Start case job', 'cases', 520),
    {
      id: 'respond',
      name: 'Return job ID',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.4,
      position: [780, 300],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: { responseCode: 202 },
      },
    },
  ],
  connections: {
    'Authenticated case request': { main: [[{ node: 'Start case job', type: 'main', index: 0 }]] },
    'Start case job': { main: [[{ node: 'Return job ID', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  active: false,
  pinData: {},
};
await writeFile(new URL('01-collect-rss.json', dir), JSON.stringify(schedule, null, 2));
await writeFile(new URL('02-create-case-api.json', dir), JSON.stringify(cases, null, 2));
console.log('Generated two inactive, credential-free n8n workflows.');
