import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

const env = readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL="([^"]+)"/)
if (!match) { console.error('DATABASE_URL not found'); process.exit(1) }
const sql = neon(match[1])

// 1. Add columns to users table
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS service_tier TEXT NOT NULL DEFAULT 'self'`
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS patisco_api_key TEXT`
console.log('✓ Added role, status, service_tier, patisco_api_key columns')

// 2. Create admin_keys table for shared keys
await sql`
  CREATE TABLE IF NOT EXISTS admin_keys (
    id SERIAL PRIMARY KEY,
    key_name TEXT UNIQUE NOT NULL,
    key_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )
`
console.log('✓ admin_keys table ready')

// 3. Create admin user even@pacture.tw
const hash = await bcrypt.hash('e32wsxcd', 10)
const [existing] = await sql`SELECT id FROM users WHERE email = 'even@pacture.tw'`
if (existing) {
  await sql`UPDATE users SET password_hash = ${hash}, role = 'admin', status = 'active' WHERE email = 'even@pacture.tw'`
  console.log('✓ Updated existing admin user even@pacture.tw')
} else {
  await sql`INSERT INTO users (email, password_hash, role, status) VALUES ('even@pacture.tw', ${hash}, 'admin', 'active')`
  console.log('✓ Created admin user even@pacture.tw')
}

// 4. Create access_requests table
await sql`
  CREATE TABLE IF NOT EXISTS access_requests (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    company TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
  )
`
console.log('✓ access_requests table ready')

console.log('\n✅ Migration complete')
process.exit(0)
