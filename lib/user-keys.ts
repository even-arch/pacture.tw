import { sql } from '@/lib/db'

export interface UserKeys {
  anthropicApiKey: string
  openaiApiKey: string
  firecrawlApiKey: string
}

async function getAdminKeys(): Promise<Record<string, string>> {
  const rows = await sql`SELECT key_name, key_value FROM admin_keys`
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key_name as string] = r.key_value as string
  return map
}

export async function getUserKeys(userId: string): Promise<UserKeys> {
  const [row] = await sql`SELECT anthropic_api_key, openai_api_key, firecrawl_api_key FROM users WHERE id = ${userId}`
  const admin = await getAdminKeys()

  return {
    anthropicApiKey:
      (row?.anthropic_api_key as string) ||
      admin['anthropic_api_key'] ||
      process.env.ANTHROPIC_API_KEY ||
      '',
    openaiApiKey:
      (row?.openai_api_key as string) ||
      admin['openai_api_key'] ||
      process.env.OPENAI_API_KEY ||
      '',
    firecrawlApiKey:
      (row?.firecrawl_api_key as string) ||
      admin['firecrawl_api_key'] ||
      process.env.FIRECRAWL_API_KEY ||
      '',
  }
}
