import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL="([^"]+)"/)
if (!match) { console.error('DATABASE_URL not found'); process.exit(1) }

const sql = neon(match[1])
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS patisco_jwt TEXT`
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`
console.log('✓ patisco_jwt + password_hash columns ready')
process.exit(0)
