import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const env = readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL="([^"]+)"/)
const sql = neon(match[1])

const EMAIL = 'even@xinosys.com'
const JWT = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhcHAiOiJnNERlc2t0b3AiLCJzdWIiOiJldmVuQHhpbm9zeXMuY29tIiwiYXVkIjoid2ViIiwiY3JlYXRlZCI6MTc4MTUzNDMwMzM0NCwiaWF0IjoxNzgxNTM0MzAzLCJqdGkiOiJkODMzZDhmZS1iMGQ5LTRlZDktYjczMS04NGFjMTIyOThkMGYiLCJleHAiOjE3ODI3NDM5MDN9.DQD9HFzKXyxxRE2FYVi0mdVL70TGWFeAX3ddh0EGCnUzb5n7XCfxOvkK_nwm0Gmx4YJgcfSlmn9az9xVYsozSA'
const API_KEY = '6a509fc8-5c2b-46ee-a994-7d7897d988b9'

const result = await sql`
  UPDATE users SET patisco_jwt = ${JWT}, patisco_api_key = ${API_KEY}
  WHERE email = ${EMAIL}
  RETURNING id, email
`
console.log('✓ Updated:', result[0])
process.exit(0)
