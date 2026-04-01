/**
 * Setup script for MyTravelConcierge Client App
 * 
 * 1. Applies SQL migration (creates tables if not exist)
 * 2. Finds existing CRM clients (party records with email)
 * 3. Creates a test client_profile with password "test1234"
 * 
 * Usage: node scripts/setup-client-app.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

// Load env vars from .env and .env.local
function loadEnvFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.substring(0, eqIdx).trim()
      const val = trimmed.substring(eqIdx + 1).trim()
      if (key) env[key] = val
    }
  } catch { /* file not found — skip */ }
}

const env = {}
loadEnvFile('.env')
loadEnvFile('.env.local')

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function main() {
  console.log('\n=== MyTravelConcierge Setup ===\n')

  // Step 1: Apply migration
  console.log('1. Applying SQL migration...')
  const sql = readFileSync('docs/migrations/001_client_app.sql', 'utf-8')
  
  const { error: migrationError } = await supabase.rpc('exec_sql', { sql_text: sql }).maybeSingle()
  
  if (migrationError) {
    // rpc exec_sql may not exist — try direct approach: just check if table exists
    console.log('   (rpc not available, checking tables directly...)')
    
    const { data: tables } = await supabase
      .from('client_profiles')
      .select('id')
      .limit(1)
    
    if (tables === null) {
      console.log('\n   ⚠️  Таблицы ещё не созданы!')
      console.log('   Нужно вручную применить миграцию:')
      console.log('   1. Открой https://supabase.com/dashboard → свой проект')
      console.log('   2. SQL Editor → New query')
      console.log('   3. Вставь содержимое docs/migrations/001_client_app.sql')
      console.log('   4. Нажми Run')
      console.log('   5. Запусти этот скрипт повторно: node scripts/setup-client-app.mjs')
      console.log('')
      process.exit(0)
    }
    console.log('   ✅ Таблицы уже существуют')
  } else {
    console.log('   ✅ Миграция применена')
  }

  // Step 2: Find CRM clients with email
  console.log('\n2. Ищу клиентов в CRM (таблица party с email)...')
  
  const { data: parties, error: partyError } = await supabase
    .from('party')
    .select('id, display_name, email, phone, party_type')
    .not('email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (partyError) {
    console.error('   Ошибка чтения party:', partyError.message)
    process.exit(1)
  }

  if (!parties || parties.length === 0) {
    console.log('   Нет клиентов с email в CRM. Создай клиента в CRM сначала.')
    process.exit(0)
  }

  console.log(`   Найдено ${parties.length} клиент(ов):`)
  parties.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.display_name || '(без имени)'} — ${p.email} [${p.party_type || 'client'}]`)
  })

  // Step 3: Check if any already have client_profiles
  const partyIds = parties.map(p => p.id)
  const { data: existing } = await supabase
    .from('client_profiles')
    .select('id, crm_client_id')
    .in('crm_client_id', partyIds)

  const existingIds = new Set((existing || []).map(e => e.crm_client_id))

  // Find first party without a client_profile
  const candidate = parties.find(p => !existingIds.has(p.id))

  if (!candidate) {
    console.log('\n   Все найденные клиенты уже зарегистрированы в приложении.')
    
    // Show login info for existing ones
    const firstExisting = parties[0]
    console.log(`\n   Можно войти с:`)
    console.log(`   📧 Email: ${firstExisting.email}`)
    console.log(`   🔑 Пароль: test1234`)
    process.exit(0)
  }

  // Step 4: Create client_profile with password "test1234"
  console.log(`\n3. Создаю аккаунт для: ${candidate.display_name} (${candidate.email})`)

  // Hash password with bcrypt — use dynamic import
  const bcrypt = await import('bcryptjs')
  const passwordHash = bcrypt.default.hashSync('test1234', 12)

  const { data: profile, error: profileError } = await supabase
    .from('client_profiles')
    .insert({
      crm_client_id: candidate.id,
      password_hash: passwordHash,
      invited_by_agent_id: null,
    })
    .select('id, referral_code')
    .single()

  if (profileError) {
    console.error('   Ошибка создания профиля:', profileError.message)
    process.exit(1)
  }

  console.log(`   ✅ Аккаунт создан!`)
  console.log(`   ID: ${profile.id}`)
  console.log(`   Реферальный код: ${profile.referral_code}`)

  // Final output
  console.log('\n' + '='.repeat(50))
  console.log('   ДАННЫЕ ДЛЯ ВХОДА В ПРИЛОЖЕНИЕ')
  console.log('='.repeat(50))
  console.log(`   📧 Email:  ${candidate.email}`)
  console.log(`   🔑 Пароль: test1234`)
  console.log('='.repeat(50))
  console.log('\n   Открой приложение на телефоне и войди!\n')
}

main().catch(err => {
  console.error('Ошибка:', err)
  process.exit(1)
})
