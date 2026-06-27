import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL="([^"]+)"/)
const sql = neon(match[1])

const rows = await sql`
  SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'users'
  ORDER BY ordinal_position
`
console.table(rows)
process.exit(0)
