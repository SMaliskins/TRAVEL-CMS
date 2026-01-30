import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/orders/[orderCode]/invoices - List all invoices for an order
// Also supports ?nextNumber=true to get next invoice number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawOrderCode } = await params;
    const orderCode = decodeURIComponent(rawOrderCode);
    
    if (!orderCode) {
      return NextResponse.json(
        { error: "Order code is required" },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const getNextNumber = searchParams.get('nextNumber') === 'true';

    // Get order ID from order_code
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError) {
      console.error("[Invoices API] Error finding order:", orderError);
      console.error("[Invoices API] Order code searched:", orderCode);
      return NextResponse.json(
        { error: `Order not found: ${orderError.message}`, orderCode },
        { status: 404 }
      );
    }
    
    if (!order) {
      console.error("[Invoices API] Order not found for code:", orderCode);
      return NextResponse.json(
        { error: "Order not found", orderCode },
        { status: 404 }
      );
    }

    // If requesting next invoice number
    if (getNextNumber) {
      // Get current user for initials
      const authHeader = request.headers.get("authorization");
      let userInitials = "XX";
      
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        
        if (!userError && user) {
          // Get user profile for first_name and last_name
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            const firstName = (profile.first_name || "").trim();
            const lastName = (profile.last_name || "").trim();
            if (firstName && lastName) {
              // First letter of first name + first 2 letters of last name
              userInitials = (firstName[0] + lastName.substring(0, 2)).toUpperCase();
            } else if (firstName) {
              userInitials = firstName.substring(0, 3).toUpperCase().padEnd(3, 'X');
            }
          }
        }
      }
      
      // Parse order code: 0014-26-sm -> ["0014", "26", "sm"]
      const parts = orderCode.split('-');
      if (parts.length >= 3) {
        const [orderNumber, yearCode, code] = parts; // orderNumber = "0014", yearCode = "26"
        
        // Get current year (last 2 digits)
        const currentYear = new Date().getFullYear().toString().slice(-2);
        
        // Get all invoices for this company in current year to find max number
        // Format: INV-0014-26-SM-219157
        // We need to find max number for invoices with same company_id and year
        const { data: invoices } = await supabaseAdmin
          .from("invoices")
          .select("invoice_number")
          .eq("company_id", order.company_id);
        
        let maxNum = 0;
        if (invoices) {
          invoices.forEach((inv: any) => {
            // Match format: INV-XXXX-YY-INITIALS-NNNNNN where YY matches current year
            const match = inv.invoice_number?.match(/INV-\d{4}-(\d{2})-[A-Z]+-(\d+)/);
            if (match) {
              const invoiceYear = match[1];
              const num = parseInt(match[2], 10);
              // Only count invoices from current year
              if (invoiceYear === currentYear && num > maxNum) {
                maxNum = num;
              }
            }
          });
        }
        const nextNum = (maxNum + 1).toString().padStart(4, '0');
        return NextResponse.json({ 
          nextInvoiceNumber: `INV-${orderNumber}-${currentYear}-${userInitials}-${nextNum}` 
        });
      }
      // Fallback
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const fallbackNum = Date.now().toString().slice(-4);
      return NextResponse.json({ 
        nextInvoiceNumber: `INV-${orderCode.replace(/\//g, '-').toUpperCase()}-${currentYear}-${userInitials}-${fallbackNum}` 
      });
    }

    // Get all invoices for this order
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from("invoices")
      .select(`
        *,
        invoice_items (
          id,
          service_id,
          service_name,
          service_client,
          service_category,
          service_date_from,
          service_date_to,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });

    if (invoicesError) {
      console.error("[Invoices API] Error fetching invoices:", invoicesError);
      console.error("[Invoices API] Order ID:", order.id);
      return NextResponse.json(
        { error: "Failed to fetch invoices", details: invoicesError.message, orderId: order.id },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      invoices: invoices || [],
      orderId: order.id,
      orderCode: orderCode 
    });
  } catch (error) {
    console.error("Error in GET /api/orders/[orderCode]/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/orders/[orderCode]/invoices - Create a new invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawOrderCode } = await params;
    const orderCode = decodeURIComponent(rawOrderCode);
    const body = await request.json();

    const {
      invoice_number,
      invoice_date,
      due_date,
      // Payer fields (Bill To)
      payer_name,
      payer_party_id,
      payer_type,
      payer_address,
      payer_email,
      payer_phone,
      payer_reg_nr,
      payer_vat_nr,
      payer_personal_code,
      payer_bank_name,
      payer_bank_account,
      payer_bank_swift,
      // Payment terms
      deposit_amount,
      deposit_date,
      final_payment_amount,
      final_payment_date,
      // Legacy client fields (for backward compatibility)
      client_name,
      client_address,
      client_email,
      items, // Array of { service_id, service_name, service_client, service_category, quantity, unit_price }
      subtotal,
      tax_rate,
      tax_amount,
      total,
      notes,
    } = body;

    // Validation
    if (!invoice_number || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: invoice_number, items" },
        { status: 400 }
      );
    }

    // Get order ID and company_id
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Check if any services are already invoiced or cancelled
    const serviceIds = items.map((s: any) => s.service_id);
    const { data: existingServices, error: checkError } = await supabaseAdmin
      .from("order_services")
      .select("id, invoice_id, res_status")
      .in("id", serviceIds);

    if (checkError) {
      console.error("Error checking services:", checkError);
      return NextResponse.json(
        { error: "Failed to check services" },
        { status: 500 }
      );
    }

    // Filter out cancelled services and check for already invoiced
    const cancelledServices = existingServices?.filter((s: any) => s.res_status === 'cancelled') || [];
    const invoicedServices = existingServices?.filter((s: any) => s.invoice_id !== null) || [];

    if (cancelledServices.length > 0) {
      return NextResponse.json(
        { error: "Some services are cancelled and cannot be invoiced" },
        { status: 400 }
      );
    }

    if (invoicedServices.length > 0) {
      return NextResponse.json(
        { error: "Some services are already invoiced" },
        { status: 400 }
      );
    }

    // Create invoice - build insert object dynamically to handle missing columns
    // Helper function to convert empty strings to null for date fields
    const normalizeDate = (date: any): string | null => {
      if (!date || date === '' || date === 'null' || date === 'undefined' || (typeof date === 'string' && date.trim() === '')) {
        return null;
      }
      // Ensure it's a valid date string format (YYYY-MM-DD)
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
      }
      return null;
    };

    const invoiceData: any = {
      invoice_number,
      order_id: order.id,
      company_id: order.company_id,
      invoice_date: invoice_date || new Date().toISOString().split("T")[0],
      due_date: normalizeDate(due_date) || (() => {
        // If due_date is explicitly empty/null, set to null, otherwise default to +14 days
        if (due_date === '' || due_date === null || due_date === undefined) {
          return null;
        }
        return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      })(),
      // Legacy client fields (for backward compatibility)
      client_name: payer_name || client_name || "",
      client_address: payer_address || client_address || "",
      client_email: payer_email || client_email || "",
      subtotal: subtotal || 0,
      tax_rate: tax_rate || 0,
      tax_amount: tax_amount || 0,
      total: total || 0,
      notes: notes || "",
      status: "draft",
      is_credit: body.is_credit || false,
    };

    // Add payer fields if they exist in schema (from add_invoice_payer_fields migration)
    // We'll try to add them, and if they don't exist, Supabase will ignore them
    if (payer_party_id !== undefined) invoiceData.payer_party_id = payer_party_id || null;
    if (payer_name !== undefined) invoiceData.payer_name = payer_name || client_name || "";
    if (payer_type !== undefined) invoiceData.payer_type = payer_type || 'company';
    if (payer_address !== undefined) invoiceData.payer_address = payer_address || client_address || "";
    if (payer_email !== undefined) invoiceData.payer_email = payer_email || client_email || "";
    if (payer_phone !== undefined) invoiceData.payer_phone = payer_phone || null;
    if (payer_reg_nr !== undefined) invoiceData.payer_reg_nr = payer_reg_nr || null;
    if (payer_vat_nr !== undefined) invoiceData.payer_vat_nr = payer_vat_nr || null;
    if (payer_personal_code !== undefined) invoiceData.payer_personal_code = payer_personal_code || null;
    if (payer_bank_name !== undefined) invoiceData.payer_bank_name = payer_bank_name || null;
    if (payer_bank_account !== undefined) invoiceData.payer_bank_account = payer_bank_account || null;
    if (payer_bank_swift !== undefined) invoiceData.payer_bank_swift = payer_bank_swift || null;
    
    // Add payment terms fields if they exist in schema (from add_invoice_payer_fields migration)
    // Only add if values are provided to avoid errors if columns don't exist
    // Note: These fields may not exist in the database yet - if migration hasn't been run
    // In that case, the insert will fail with a column not found error
    // To fix: Run migrations/add_invoice_payment_terms.sql in Supabase SQL Editor
    try {
      // Only add deposit_amount if it has a valid value
      if (deposit_amount !== undefined && deposit_amount !== null && deposit_amount !== '' && !isNaN(Number(deposit_amount))) {
        invoiceData.deposit_amount = Number(deposit_amount);
      }
      // Only add deposit_date if it's a valid date string
      const normalizedDepositDate = normalizeDate(deposit_date);
      if (normalizedDepositDate !== null) {
        invoiceData.deposit_date = normalizedDepositDate;
      }
      // Only add final_payment_amount if it has a valid value
      if (final_payment_amount !== undefined && final_payment_amount !== null && final_payment_amount !== '' && !isNaN(Number(final_payment_amount))) {
        invoiceData.final_payment_amount = Number(final_payment_amount);
      }
      // Only add final_payment_date if it's a valid date string
      const normalizedFinalPaymentDate = normalizeDate(final_payment_date);
      if (normalizedFinalPaymentDate !== null) {
        invoiceData.final_payment_date = normalizedFinalPaymentDate;
      }
    } catch (e) {
      // If columns don't exist, we'll catch the error below
      console.warn('Payment terms fields may not exist in database schema', e);
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error("Error creating invoice:", invoiceError);
      console.error("Invoice data attempted:", {
        invoice_number,
        order_id: order.id,
        company_id: order.company_id,
        invoice_date: invoice_date || new Date().toISOString().split("T")[0],
        due_date: due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });
      
      // Check if error is about missing columns
      const errorMessage = invoiceError?.message || "Unknown error";
      if (errorMessage.includes("deposit_amount") || errorMessage.includes("column") && errorMessage.includes("not found")) {
        return NextResponse.json(
          { 
            error: `Database schema error: Missing payment terms columns. Please run migration: migrations/add_invoice_payment_terms.sql in Supabase SQL Editor`,
            details: errorMessage
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to create invoice: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Create invoice items
    const invoiceItems = items.map((item: any) => ({
      invoice_id: invoice.id,
      service_id: item.service_id,
      service_name: item.service_name || "",
      service_client: item.service_client || "",
      service_category: item.service_category || "",
      service_date_from: item.service_date_from || null,
      service_date_to: item.service_date_to || null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      line_total: (item.quantity || 1) * (item.unit_price || 0),
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      console.error("Error creating invoice items:", itemsError);
      console.error("Invoice items attempted:", invoiceItems);
      // Rollback: delete the invoice
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: `Failed to create invoice items: ${itemsError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Update order_services to link them to this invoice
    const { error: updateServicesError } = await supabaseAdmin
      .from("order_services")
      .update({ invoice_id: invoice.id })
      .in("id", serviceIds);

    if (updateServicesError) {
      console.error("Error updating services:", updateServicesError);
      console.error("Service IDs attempted:", serviceIds);
      // Rollback: delete invoice and items
      await supabaseAdmin.from("invoice_items").delete().eq("invoice_id", invoice.id);
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: `Failed to update services: ${updateServicesError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        invoice_items: invoiceItems,
      },
    });
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR in POST /api/orders/[orderCode]/invoices:");
    console.error("Error message:", error?.message);
    console.error("Error code:", error?.code);
    console.error("Error details:", error?.details);
    console.error("Full error:", error);
    return NextResponse.json(
      { 
        error: `Internal server error: ${error?.message || "Unknown error"}`,
        code: error?.code || "UNKNOWN",
        details: error?.details || null
      },
      { status: 500 }
    );
  }
}
