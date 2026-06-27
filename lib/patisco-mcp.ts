const MCP_URL = 'https://mcp.patisco.com/mcp'

interface McpSession {
  sessionId: string
  jwt: string
  apiKey: string
}

interface McpResponse<T> {
  result?: { structuredContent?: T; content?: Array<{ type: string; text: string }> }
  error?: { code: number; message: string }
  jsonrpc: string
  id: number
}

async function mcpRequest<T>(
  session: McpSession,
  id: number,
  method: string,
  params: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${session.jwt}`,
    'X-Api-Key': session.apiKey,
  }
  if (session.sessionId) {
    headers['Mcp-Session-Id'] = session.sessionId
  }

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })

  const text = await res.text()
  // SSE format: lines starting with "data: "
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
  if (!dataLine) throw new Error(`No data in response: ${text}`)
  const json: McpResponse<T> = JSON.parse(dataLine.slice(6))
  if (json.error) throw new Error(`MCP error ${json.error.code}: ${json.error.message}`)
  return json.result?.structuredContent as T
}

async function createSession(jwt: string, apiKey: string): Promise<McpSession> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${jwt}`,
    'X-Api-Key': apiKey,
  }

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'pacture', version: '1.0.0' },
      },
    }),
  })

  const sessionId = res.headers.get('mcp-session-id') ?? ''
  return { sessionId, jwt, apiKey }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PatiscoPIListItem {
  id: string
  no: string
  status: string
  buyer: string
  price: string
  itemsCount: string
  currencyCode: string
  createdDate: string
  lastModifiedDate: string
  po: { id: string; no: string } | null
}

export interface PatiscoPIDetail {
  id: string
  no: string
  status: string
  buyer: {
    id: string
    name: string
    countryCode: string
    city?: string
    email?: string
  }
  seller: { name: string; countryCode: string }
  shippingInfo: { countryCode: string }
  products: Array<{
    id: string
    sku: string
    modelNo: string
    specification: string
    note: string
    price: string
    quantity: string
    unit: string
  }>
}

export interface PIListResult {
  items: PatiscoPIListItem[]
  totalCount: number
  statusBreakdown: { confirmed: number; archived: number }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listProformaInvoices(jwt: string, apiKey: string): Promise<PIListResult> {
  const session = await createSession(jwt, apiKey)
  const data = await mcpRequest<{
    items: PatiscoPIListItem[]
    totalCount: number
    statusBreakdown: { confirmed: number; archived: number }
  }>(session, 2, 'tools/call', {
    name: 'listProformaInvoices',
    arguments: { fetchAll: true },
  })
  return {
    items: data.items ?? [],
    totalCount: data.totalCount ?? 0,
    statusBreakdown: data.statusBreakdown ?? { confirmed: 0, archived: 0 },
  }
}

export async function getOrderDetail(
  session: McpSession,
  orderId: string,
  callId: number
): Promise<PatiscoPIDetail> {
  const data = await mcpRequest<{
    detail: PatiscoPIDetail & { buyer: PatiscoPIDetail['buyer'] }
    products: { items: PatiscoPIDetail['products'] }
  }>(session, callId, 'tools/call', {
    name: 'getOrderDetail',
    arguments: { orderId },
  })
  return {
    ...data.detail,
    products: data.products?.items ?? [],
  }
}

export { createSession }
