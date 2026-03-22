#!/usr/bin/env node
/**
 * Seed Demo Presentation Company
 *
 * Creates a fully isolated test company with demo data for presentations.
 * Data is 100% separate from your production — different company_id.
 *
 * Run: node --env-file=.env.local scripts/seed-demo-presentation.mjs
 * Or:  SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-demo-presentation.mjs
 */

import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@travel-cms.presentation";
const DEMO_PASSWORD = "Demo2026!Secure";
const DEMO_COMPANY_NAME = "Demo Presentation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log("=== Seeding Demo Presentation Company ===\n");

  // 1. Create company
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .insert({ name: DEMO_COMPANY_NAME })
    .select("id")
    .single();

  if (companyErr) {
    if (companyErr.code === "23505") {
      const { data: existing } = await admin.from("companies").select("id").eq("name", DEMO_COMPANY_NAME).single();
      if (existing) {
        console.log("Demo company already exists, reusing:", existing.id);
        await seedData(existing.id, null);
        return;
      }
    }
    console.error("Failed to create company:", companyErr);
    process.exit(1);
  }

  const companyId = company.id;
  console.log("Created company:", companyId);

  // 2. Create auth user
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  let userId;
  if (authErr) {
    if (authErr.message?.includes("already") || authErr.message?.includes("exists")) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const u = list?.users?.find((x) => x.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());
      if (u) {
        userId = u.id;
        await admin.auth.admin.updateUserById(u.id, { password: DEMO_PASSWORD });
        console.log("Demo user exists, password reset");
      } else {
        console.error("User exists but not found:", authErr);
        process.exit(1);
      }
    } else {
      console.error("Failed to create user:", authErr);
      process.exit(1);
    }
  } else {
    userId = authUser.user.id;
    console.log("Created demo user:", userId);
  }

  // 3. Create user_profiles (or profiles fallback)
  const { data: supervisorRole } = await admin.from("roles").select("id").eq("name", "supervisor").single();

  const profileData = {
    id: userId,
    company_id: companyId,
    role_id: supervisorRole?.id ?? null,
    first_name: "Demo",
    last_name: "User",
    is_active: true,
  };

  const { error: profileErr } = await admin.from("user_profiles").upsert(profileData, { onConflict: "id" });

  if (profileErr) {
    // Fallback: try profiles table (user_id)
    const { error: profilesErr } = await admin.from("profiles").upsert(
      { user_id: userId, company_id: companyId, role: "supervisor", display_name: "Demo User" },
      { onConflict: "user_id" }
    );
    if (profilesErr) {
      console.error("Failed to create profile:", profileErr, profilesErr);
      process.exit(1);
    }
    console.log("Created profile (profiles table)");
  } else {
    console.log("Created user_profiles");
  }

  await seedData(companyId, userId);
}

async function seedData(companyId, userId) {
  if (!userId) {
    const { data: u } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const demo = u?.users?.find((x) => x.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());
    userId = demo?.id;
  }
  if (!userId) {
    console.error("Demo user not found, skipping data seed");
    return;
  }

  // Skip data if already seeded (idempotent re-run)
  const { count } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  if (count > 0) {
    console.log("\nDemo data already exists, skipping seed. Credentials:");
    printCredentials();
    return;
  }

  console.log("\n--- Seeding Directory (Party) ---");

  // Clients (persons)
  const clients = [
    { display: "Anna Bērziņa", first: "Anna", last: "Bērziņa", email: "anna.berzina@example.com", phone: "+371 29123456" },
    { display: "Jānis Kalniņš", first: "Jānis", last: "Kalniņš", email: "janis.kalnins@example.com", phone: "+371 29234567" },
    { display: "Maria Petrova", first: "Maria", last: "Petrova", email: "maria.petrova@example.com", phone: "+371 29345678" },
    { display: "Thomas Weber", first: "Thomas", last: "Weber", email: "thomas.weber@example.com", phone: "+49 170 1234567" },
  ];

  const partyIds = [];
  for (const c of clients) {
    const { data: party } = await admin
      .from("party")
      .insert({
        company_id: companyId,
        display_name: c.display,
        party_type: "person",
        status: "active",
        email: c.email,
        phone: c.phone,
        created_by: userId,
      })
      .select("id")
      .single();
    if (party) {
      await admin.from("party_person").insert({
        party_id: party.id,
        first_name: c.first,
        last_name: c.last,
      });
      await admin.from("client_party").insert({ party_id: party.id, company_id: companyId });
      partyIds.push(party.id);
    }
  }
  console.log("Created", partyIds.length, "client(s)");

  // Suppliers (companies)
  const suppliers = [
    { name: "Air Baltic Corporation", email: "b2b@airbaltic.com" },
    { name: "Radisson Blu Riga", email: "groups@radisson.lv" },
    { name: "Avis Rent a Car", email: "b2b@avis.lv" },
  ];
  const supplierIds = [];
  for (const s of suppliers) {
    const { data: party } = await admin
      .from("party")
      .insert({
        company_id: companyId,
        display_name: s.name,
        party_type: "company",
        status: "active",
        email: s.email,
        created_by: userId,
      })
      .select("id")
      .single();
    if (party) {
      await admin.from("party_company").insert({ party_id: party.id, company_name: s.name });
      await admin.from("partner_party").insert({ party_id: party.id, company_id: companyId });
      supplierIds.push(party.id);
    }
  }
  console.log("Created", supplierIds.length, "supplier(s)");

  console.log("\n--- Seeding Orders ---");

  const clientId = partyIds[0];
  const supplierId = supplierIds[0];

  const orderPayloads = [
    {
      order_no: 1,
      order_year: 2026,
      order_code: "0001/26-DEM",
      order_type: "leisure",
      order_source: "TA",
      status: "Active",
      client_display_name: clients[0].display,
      client_party_id: clientId,
      countries_cities: "Riga, Latvia | Paris, France",
      date_from: "2026-04-15",
      date_to: "2026-04-22",
      amount_total: 2450,
      amount_paid: 1200,
      amount_debt: 1250,
      profit_estimated: 380,
    },
    {
      order_no: 2,
      order_year: 2026,
      order_code: "0002/26-DEM",
      order_type: "leisure",
      order_source: "TA",
      status: "Completed",
      client_display_name: clients[1].display,
      client_party_id: partyIds[1],
      countries_cities: "Vilnius, Lithuania | Rome, Italy",
      date_from: "2026-03-01",
      date_to: "2026-03-08",
      amount_total: 1890,
      amount_paid: 1890,
      amount_debt: 0,
      profit_estimated: 295,
    },
    {
      order_no: 3,
      order_year: 2026,
      order_code: "0003/26-DEM",
      order_type: "leisure",
      order_source: "TO",
      status: "Active",
      client_display_name: clients[2].display,
      client_party_id: partyIds[2],
      countries_cities: "Barcelona, Spain",
      date_from: "2026-05-10",
      date_to: "2026-05-17",
      amount_total: 3200,
      amount_paid: 0,
      amount_debt: 3200,
      profit_estimated: 420,
    },
  ];

  const orderIds = [];
  for (const o of orderPayloads) {
    let payload = {
      company_id: companyId,
      owner_user_id: userId,
      manager_user_id: userId,
      order_no: o.order_no,
      order_year: o.order_year,
      order_code: o.order_code,
      order_type: o.order_type,
      order_source: o.order_source ?? "TA",
      status: o.status,
      client_display_name: o.client_display_name,
      countries_cities: o.countries_cities,
      date_from: o.date_from,
      date_to: o.date_to,
      amount_total: o.amount_total,
      amount_paid: o.amount_paid,
      amount_debt: o.amount_debt,
      profit_estimated: o.profit_estimated,
      client_party_id: o.client_party_id,
    };
    const optionalCols = ["client_party_id", "manager_user_id"];
    let inserted = null;
    for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
      const { data: ord, error: orderErr } = await admin
        .from("orders")
        .insert(payload)
        .select("id")
        .single();
      if (!orderErr && ord) {
        inserted = ord;
        break;
      }
      if (orderErr?.code === "42703" || orderErr?.message?.includes("column")) {
        const match = orderErr.message?.match(/"([a-z_]+)"/);
        const col = match?.[1];
        if (col && col in payload) {
          delete payload[col];
          continue;
        }
      }
      console.error("Order insert error:", orderErr?.message, "for", o.order_code);
      break;
    }
    if (inserted) orderIds.push(inserted);
  }

  console.log("Created", orderIds.length, "order(s)");
  if (orderIds.length === 0) {
    console.error("No orders created. Check errors above. Skipping invoices/payments.");
    printCredentials();
    return;
  }

  // Order services
  const categories = await admin
    .from("travel_service_categories")
    .select("id")
    .eq("company_id", companyId)
    .limit(3);
  const catId = categories.data?.[0]?.id ?? null;

  for (let i = 0; i < orderIds.length; i++) {
    const ord = orderIds[i];
    const svcs = [
      { name: "Flight RIX–CDG", cost: 320, sale: 450, from: "2026-04-15", to: "2026-04-15" },
      { name: "Hotel 7 nights", cost: 420, sale: 650, from: "2026-04-15", to: "2026-04-22" },
    ];
    for (const s of svcs) {
      await admin.from("order_services").insert({
        company_id: companyId,
        order_id: ord.id,
        service_name: s.name,
        service_price: s.cost,
        client_price: s.sale,
        service_date_from: s.from,
        service_date_to: s.to,
        client_party_id: clientId,
        payer_party_id: clientId,
        supplier_party_id: supplierId,
        res_status: "confirmed",
        service_category_id: catId,
      });
    }
  }
  console.log("Created order services");

  // Invoices
  const invPayloads = [
    { number: "INV-2026-001", total: 2450, status: "sent", date: "2026-03-01" },
    { number: "INV-2026-002", total: 1890, status: "paid", date: "2026-02-15" },
  ];
  const invoiceIds = [];
  for (let i = 0; i < Math.min(invPayloads.length, orderIds.length); i++) {
    const inv = invPayloads[i];
    const { data: invRow } = await admin
      .from("invoices")
      .insert({
        company_id: companyId,
        order_id: orderIds[i].id,
        invoice_number: inv.number,
        invoice_date: inv.date,
        total: inv.total,
        subtotal: inv.total / 1.21,
        tax_amount: inv.total - inv.total / 1.21,
        tax_rate: 21,
        status: inv.status,
        client_name: orderPayloads[i].client_display_name,
        payer_name: orderPayloads[i].client_display_name,
      })
      .select("id")
      .single();
    if (invRow) invoiceIds.push(invRow);
  }
  console.log("Created", invoiceIds.length, "invoice(s)");

  // Invoice items
  const services = await admin.from("order_services").select("id, service_name, client_price").eq("company_id", companyId).limit(4);
  for (let i = 0; i < Math.min(invoiceIds.length, services.data?.length ?? 0); i++) {
    const svc = services.data[i];
    if (svc && invoiceIds[i]) {
      await admin.from("invoice_items").insert({
        invoice_id: invoiceIds[i].id,
        service_id: svc.id,
        service_name: svc.service_name,
        quantity: 1,
        unit_price: svc.client_price,
        line_total: svc.client_price,
      });
    }
  }

  // Payments
  const { data: bankAcc } = await admin
    .from("company_bank_accounts")
    .insert({
      company_id: companyId,
      account_name: "Demo Business Account",
      bank_name: "Demo Bank",
      currency: "EUR",
      is_default: true,
      is_active: true,
    })
    .select("id")
    .single();

  for (let i = 0; i < Math.min(2, orderIds.length); i++) {
    const ord = orderIds[i];
    if (!ord?.id) continue;
    await admin.from("payments").insert({
      company_id: companyId,
      order_id: ord.id,
      invoice_id: invoiceIds[i]?.id ?? null,
      method: i === 0 ? "bank" : "card",
      amount: i === 0 ? 1200 : 1890,
      currency: "EUR",
      paid_at: new Date().toISOString(),
      account_id: bankAcc?.id ?? null,
      payer_name: orderPayloads[i]?.client_display_name ?? "Client",
    });
  }
  console.log("Created payments");

  // Company expenses (supervisor/finance view)
  await admin.from("company_expense_invoices").insert([
    { company_id: companyId, supplier: "Office Rent", invoice_date: "2026-03-01", amount: 850, currency: "EUR", description: "March rent" },
    { company_id: companyId, supplier: "Utilities", invoice_date: "2026-03-15", amount: 120, currency: "EUR", description: "Electricity & heating" },
  ]);
  console.log("Created company expenses");

  // System update notification for demo company
  await admin
    .from("staff_notifications")
    .insert({
      company_id: companyId,
      type: "system_update",
      title: '{"en":"Demo Environment","ru":"Демо","lv":"Demo"}',
      message: '{"en":"This is a demo for presentations. All data is fictional.","ru":"Демо для презентаций.","lv":"Demo videi. Visi dati ir fiktīvi."}',
      ref_id: "system_update:2026-03-demo",
    })
    .then(() => console.log("Created system notification"))
    .catch(() => {});

  console.log("\n=== DONE ===\n");
  printCredentials();
}

function printCredentials() {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  console.log("Access credentials:");
  console.log("  Email:    " + DEMO_EMAIL);
  console.log("  Password: " + DEMO_PASSWORD);
  console.log("  URL:      " + base + "/login");
  console.log("\nData is isolated by company_id. Your production data is not affected.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
