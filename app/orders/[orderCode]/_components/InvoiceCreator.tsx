"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface Service {
  id: string;
  name: string;
  clientPrice: number;
  category: string;
  dateFrom?: string;
  dateTo?: string;
  client?: string;
  clientPartyId?: string;
  payer?: string;
  payerPartyId?: string;
  paymentDeadlineDeposit?: string | null;
  paymentDeadlineFinal?: string | null;
  paymentTerms?: string | null;
}

interface InvoiceCreatorProps {
  orderCode: string;
  clientName: string | null;
  selectedServices: Service[];
  servicesByPayer?: Map<string, Service[]>;
  onClose: () => void;
  onSuccess?: () => void;
}

interface CompanyInfo {
  name: string;
  legalName?: string;
  address: string;
  legalAddress?: string;
  city: string;
  country: string;
  email: string;
  phone?: string;
  regNr?: string;
  vatNr?: string;
  bankName?: string;
  bankAccount?: string;
  bankSwift?: string;
  logoUrl?: string | null;
}

interface PartyInfo {
  id: string;
  name: string;
  type: 'company' | 'person';
  address?: string;
  email?: string;
  phone?: string;
  regNr?: string;
  vatNr?: string;
  personalCode?: string;
  bankName?: string;
  bankAccount?: string;
  bankSwift?: string;
}

export default function InvoiceCreator({
  orderCode,
  clientName,
  selectedServices,
  servicesByPayer,
  onClose,
  onSuccess,
}: InvoiceCreatorProps) {
  // Check if we have multiple payers
  const hasMultiplePayers = servicesByPayer && servicesByPayer.size > 1;
  
  // Get payer from first service (all should have same payer for single payer mode)
  const payerFromService = selectedServices[0]?.payer;
  const payerPartyIdFromService = selectedServices[0]?.payerPartyId;
  
  // State for multiple invoices creation
  const [currentPayerIndex, setCurrentPayerIndex] = useState(0);
  const [payerGroups, setPayerGroups] = useState<Array<{ payerKey: string; payerName: string; services: Service[] }>>([]);
  
  // Initialize payer groups if multiple payers
  useEffect(() => {
    if (hasMultiplePayers && servicesByPayer) {
      const groups: Array<{ payerKey: string; payerName: string; services: Service[] }> = [];
      servicesByPayer.forEach((services, payerKey) => {
        // Get payer name from first service (normalized key -> original name)
        const payerName = services[0]?.payer?.trim() || 'Unknown Payer';
        groups.push({ payerKey, payerName, services });
      });
      setPayerGroups(groups);
      // Initialize first group
      if (groups.length > 0) {
        setCurrentPayerIndex(0);
      }
    } else {
      // Single payer mode
      setPayerGroups([]);
      setCurrentPayerIndex(0);
    }
  }, [hasMultiplePayers, servicesByPayer]);
  
  // Get current services based on mode
  const currentServices = hasMultiplePayers && payerGroups.length > 0
    ? payerGroups[currentPayerIndex]?.services || []
    : selectedServices;
  
  // Get payer from current services
  const currentPayerFromService = currentServices[0]?.payer;
  const currentPayerPartyIdFromService = currentServices[0]?.payerPartyId;
  
  // Generate invoice number: INV-0014-26-SM-407469 format
  const generateInvoiceNumber = async (suffix?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices?nextNumber=true`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        const baseNumber = data.nextInvoiceNumber;
        if (!baseNumber) {
          console.error('No invoice number returned from API');
          throw new Error('Failed to get invoice number from API');
        }
        return suffix ? `${baseNumber}-${suffix}` : baseNumber;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error generating invoice number:', errorData);
        throw new Error(errorData.error || 'Failed to generate invoice number');
      }
    } catch (e: any) {
      console.error('Error generating invoice number:', e);
      // Fallback
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const fallbackNum = Date.now().toString().slice(-4);
      const base = `INV-${orderCode.replace(/\//g, '-').toUpperCase()}-${currentYear}-XX-${fallbackNum}`;
      return suffix ? `${base}-${suffix}` : base;
    }
  };

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  });
  
  // Bill To - using Payer
  const [payerPartyId, setPayerPartyId] = useState<string | null>(currentPayerPartyIdFromService || null);
  const [payerInfo, setPayerInfo] = useState<PartyInfo | null>(null);
  const [payerName, setPayerName] = useState(currentPayerFromService || "");
  const [payerType, setPayerType] = useState<'company' | 'person'>('company');
  const [payerAddress, setPayerAddress] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  // Company fields
  const [payerRegNr, setPayerRegNr] = useState("");
  const [payerVatNr, setPayerVatNr] = useState("");
  const [payerBankName, setPayerBankName] = useState("");
  const [payerBankAccount, setPayerBankAccount] = useState("");
  const [payerBankSwift, setPayerBankSwift] = useState("");
  // Person fields
  const [payerPersonalCode, setPayerPersonalCode] = useState("");
  
  // Company info (From)
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  
  // Editable services - initialized with currentServices
  const [editableServices, setEditableServices] = useState<Array<Service & {
    editableName: string;
    editablePrice: number;
    editableClient: string;
  }>>([]);
  
  // Update editable services and payer info when current services change (for multiple payers)
  // Invoice service name = Name from service (always s.name)
  useEffect(() => {
    setEditableServices(currentServices.map(s => ({
      ...s,
      editableName: s.name,
      editablePrice: s.clientPrice,
      editableClient: s.client || "",
    })));
    // Reset payer info for new group
    if (currentServices.length > 0) {
      const newPayerName = currentServices[0]?.payer || "";
      const newPayerPartyId = currentServices[0]?.payerPartyId || null;
      setPayerName(newPayerName);
      setPayerPartyId(newPayerPartyId);
      
      // Load payer details from DB if partyId exists
      if (newPayerPartyId) {
        fetch(`/api/directory/${newPayerPartyId}`)
          .then(res => res.json())
          .then(data => {
            if (data) {
              setPayerInfo(data);
              setPayerType(data.type === 'person' ? 'person' : 'company');
              setPayerAddress(data.address || "");
              setPayerEmail(data.email || "");
              setPayerPhone(data.phone || "");
              if (data.type === 'company') {
                setPayerRegNr(data.regNr || data.registrationNumber || "");
                setPayerVatNr(data.vatNr || data.vatNumber || "");
                setPayerBankName(data.bankName || "");
                setPayerBankAccount(data.bankAccount || "");
                setPayerBankSwift(data.bankSwift || "");
              } else {
                setPayerPersonalCode(data.personalCode || "");
              }
            }
          })
          .catch(e => console.error('Error loading payer info:', e));
      } else {
        // Clear payer fields if no partyId
        setPayerInfo(null);
        setPayerAddress("");
        setPayerEmail("");
        setPayerPhone("");
        setPayerRegNr("");
        setPayerVatNr("");
        setPayerPersonalCode("");
        setPayerBankName("");
        setPayerBankAccount("");
        setPayerBankSwift("");
      }
    }
  }, [currentServices, currentPayerIndex, payerGroups]);
  
  const [taxRate, setTaxRate] = useState(0);

  // Payment terms - with % support
  const [depositType, setDepositType] = useState<'amount' | 'percent'>('amount');
  const [depositValue, setDepositValue] = useState<number | null>(null);
  const [depositDate, setDepositDate] = useState<string>("");
  const [finalPaymentAmount, setFinalPaymentAmount] = useState<number | null>(null);
  const [finalPaymentDate, setFinalPaymentDate] = useState<string>("");
  const [isFinalPaymentManual, setIsFinalPaymentManual] = useState(false);
  const depositDateInputRef = useRef<HTMLInputElement>(null);
  const finalPaymentDateInputRef = useRef<HTMLInputElement>(null);
  const [showTypePopover, setShowTypePopover] = useState(false);
  const typePopoverRef = useRef<HTMLDivElement>(null);

  // Close type popover on click outside (not on trigger or popover)
  useEffect(() => {
    if (!showTypePopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (typePopoverRef.current?.contains(target) || target.closest("[data-type-trigger]")) return;
      setShowTypePopover(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTypePopover]);

  // Load invoice number on mount
  useEffect(() => {
    generateInvoiceNumber().then(setInvoiceNumber);
  }, [orderCode]);

  // Default deposit date to today on mount (once)
  useEffect(() => {
    const d = new Date();
    const today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    setDepositDate((prev) => (prev ? prev : today));
  }, []);

  // Load company info from settings
  useEffect(() => {
    const loadCompanyInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const response = await fetch('/api/company/info', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setCompanyInfo({
            name: data.name || "Your Company Name",
            legalName: data.legalName || data.name || "Your Company Name",
            address: data.address || "Your Address",
            legalAddress: data.legalAddress || data.address || "Your Address",
            city: data.city || "City",
            country: data.country || "Country",
            email: data.email || "contact@company.com",
            phone: data.phone,
            regNr: data.regNr,
            vatNr: data.vatNr,
            bankName: data.bankName,
            bankAccount: data.bankAccount,
            bankSwift: data.bankSwift,
            logoUrl: data.logoUrl || null,
          });
        } else {
          // Fallback to placeholder
          setCompanyInfo({
            name: "Your Company Name",
            legalName: "Your Company Name",
            address: "Your Address",
            legalAddress: "Your Address",
            city: "City",
            country: "Country",
            email: "contact@company.com",
          });
        }
      } catch (e) {
        console.error('Error loading company info:', e);
        // Fallback to placeholder
        setCompanyInfo({
          name: "Your Company Name",
          address: "Your Address",
          city: "City",
          country: "Country",
          email: "contact@company.com",
        });
      }
    };
    loadCompanyInfo();
  }, []);

  // Calculate subtotal, tax, and total FIRST (before deposit calculations)
  const subtotal = useMemo(() => 
    editableServices.reduce((sum, s) => sum + s.editablePrice, 0),
    [editableServices]
  );

  const taxAmount = useMemo(() => 
    Math.round((subtotal * taxRate / 100) * 100) / 100,
    [subtotal, taxRate]
  );

  const total = useMemo(() => 
    subtotal + taxAmount,
    [subtotal, taxAmount]
  );

  const isCredit = total < 0;
  const invoiceType = isCredit ? "Credit Note" : "Invoice";
  
  // Calculate deposit and final payment (AFTER total is calculated)
  const calculatedDeposit = useMemo(() => {
    if (!depositValue) return null;
    if (depositType === 'percent') {
      return Math.round((total * depositValue / 100) * 100) / 100;
    }
    return depositValue;
  }, [depositValue, depositType, total]);
  
  const calculatedFinalPayment = useMemo(() => {
    if (calculatedDeposit === null) return total > 0 ? Math.round(total * 100) / 100 : null;
    return Math.round((total - calculatedDeposit) * 100) / 100;
  }, [calculatedDeposit, total]);

  // When deposit is %, final payment % = 100 - deposit %
  const finalPaymentPercent = depositType === 'percent' && depositValue != null ? 100 - depositValue : null;
  
  // Update final payment when deposit changes (only if not manually edited)
  useEffect(() => {
    if (calculatedFinalPayment !== null && !isFinalPaymentManual) {
      setFinalPaymentAmount(calculatedFinalPayment);
    }
  }, [calculatedFinalPayment, isFinalPaymentManual]);

  // Initialize payer from service (only for single payer mode)
  useEffect(() => {
    if (!hasMultiplePayers) {
      if (currentPayerPartyIdFromService) {
        setPayerPartyId(currentPayerPartyIdFromService);
      }
      if (currentPayerFromService) {
        setPayerName(currentPayerFromService);
      }
    }
  }, [currentPayerPartyIdFromService, currentPayerFromService, hasMultiplePayers]);

  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    const formatted = `€${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const formatDate = (dateString: string) => formatDateDDMMYYYY(dateString || null);

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Payment terms per service: category, sum, payment terms text
  const paymentTermsByService = useMemo(() => {
    return currentServices
      .filter((s) => s.paymentTerms?.trim())
      .map((s) => ({
        category: s.category || "Service",
        name: s.name,
        sum: s.clientPrice,
        paymentTerms: s.paymentTerms!.trim(),
      }));
  }, [currentServices]);

  // Service with largest sum (for default deposit/full from its payment terms)
  const serviceWithLargestSum = useMemo(() => {
    if (currentServices.length === 0) return null;
    return currentServices.reduce((a, b) => (a.clientPrice >= b.clientPrice ? a : b));
  }, [currentServices]);

  // Earliest service start date for Final Payment Date presets
  const earliestServiceDate = useMemo(() => {
    const dates = editableServices.map((s) => s.dateFrom).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort()[0];
  }, [editableServices]);

  // Full Payment: no deposit, so remainder is 100% of total
  const isFullPayment = Boolean(total > 0 && (calculatedDeposit == null || calculatedDeposit === 0));

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Default deposit from service with largest sum (parse "10% deposit, 90% final") — once when services have terms
  const defaultDepositFromServicesApplied = React.useRef(false);
  useEffect(() => {
    const svc = serviceWithLargestSum;
    if (!svc?.paymentTerms?.trim() || defaultDepositFromServicesApplied.current) return;
    const terms = svc.paymentTerms.trim();
    const percentMatch = terms.match(/(\d+)\s*%\s*deposit/i) || terms.match(/deposit\s*(\d+)\s*%/i);
    const pct = percentMatch ? parseInt(percentMatch[1], 10) : null;
    if (pct != null && !isNaN(pct) && pct >= 0 && pct <= 100) {
      setDepositType("percent");
      setDepositValue(pct);
      defaultDepositFromServicesApplied.current = true;
    }
  }, [serviceWithLargestSum]);

  const createInvoiceForServices = async (services: typeof editableServices, payerInfo: {
    name: string;
    partyId: string | null;
    type: 'company' | 'person';
    address: string;
    email: string;
    phone: string;
    regNr: string;
    vatNr: string;
    personalCode: string;
    bankName: string;
    bankAccount: string;
    bankSwift: string;
  }, invoiceNum: string) => {
    const servicesSubtotal = services.reduce((sum, s) => sum + s.editablePrice, 0);
    const servicesTaxAmount = Math.round((servicesSubtotal * taxRate / 100) * 100) / 100;
    const servicesTotal = servicesSubtotal + servicesTaxAmount;
    
    const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_number: invoiceNum,
        payer_name: payerInfo.name,
        payer_party_id: payerInfo.partyId,
        payer_type: payerInfo.type,
        payer_address: payerInfo.address,
        payer_email: payerInfo.email,
        payer_phone: payerInfo.phone,
        payer_reg_nr: payerInfo.regNr,
        payer_vat_nr: payerInfo.vatNr,
        payer_personal_code: payerInfo.personalCode,
        payer_bank_name: payerInfo.bankName,
        payer_bank_account: payerInfo.bankAccount,
        payer_bank_swift: payerInfo.bankSwift,
        invoice_date: invoiceDate,
        due_date: (dueDate && dueDate.trim() !== '') ? dueDate : null,
        subtotal: servicesSubtotal,
        tax_rate: taxRate,
        tax_amount: servicesTaxAmount,
        total: servicesTotal,
        deposit_amount: calculatedDeposit || null,
        deposit_date: (depositDate && depositDate.trim() !== '') ? depositDate : null,
        final_payment_amount: (isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment) || null,
        final_payment_date: (finalPaymentDate && finalPaymentDate.trim() !== '') ? finalPaymentDate : null,
        status: 'draft',
        is_credit: servicesTotal < 0,
        items: services.map((s) => ({
          service_id: s.id,
          service_name: s.editableName,
          service_client: s.editableClient,
          service_date_from: s.dateFrom,
          service_date_to: s.dateTo,
          quantity: 1,
          unit_price: s.editablePrice,
          line_total: s.editablePrice,
        })),
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create invoice';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
        console.error('API Error Response:', error);
      } catch (e) {
        console.error('Failed to parse error response:', e);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const handleSave = async () => {
    if (!payerName.trim()) {
      alert('Please enter payer name');
      return;
    }

    if (editableServices.length === 0) {
      alert('Please select at least one service');
      return;
    }

    setIsSaving(true);
    try {
      if (hasMultiplePayers && payerGroups.length > 1) {
        // Create invoices for all payer groups
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < payerGroups.length; i++) {
          const group = payerGroups[i];
          try {
            // Generate invoice number for this group
            // For multiple invoices, add a delay to ensure unique numbers (each call queries DB for max)
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            const invNum = await generateInvoiceNumber();
            if (!invNum) {
              throw new Error('Failed to generate invoice number');
            }
            // Load payer info for this group
            const groupPayerPartyId = group.services[0]?.payerPartyId || null;
            let groupPayerInfo = {
              name: group.payerName,
              partyId: groupPayerPartyId,
              type: 'company' as 'company' | 'person',
              address: "",
              email: "",
              phone: "",
              regNr: "",
              vatNr: "",
              personalCode: "",
              bankName: "",
              bankAccount: "",
              bankSwift: "",
            };
            
            // Try to load payer details from DB
            if (groupPayerPartyId) {
              try {
                const payerRes = await fetch(`/api/directory/${groupPayerPartyId}`);
                if (payerRes.ok) {
                  const payerData = await payerRes.json();
                  groupPayerInfo = {
                    name: payerData.displayName || payerData.name || group.payerName,
                    partyId: groupPayerPartyId,
                    type: (payerData.type === 'person' ? 'person' : 'company') as 'company' | 'person',
                    address: payerData.address || "",
                    email: payerData.email || "",
                    phone: payerData.phone || "",
                    regNr: payerData.regNr || payerData.registrationNumber || "",
                    vatNr: payerData.vatNr || payerData.vatNumber || "",
                    personalCode: payerData.personalCode || "",
                    bankName: payerData.bankName || "",
                    bankAccount: payerData.bankAccount || "",
                    bankSwift: payerData.bankSwift || "",
                  };
                }
              } catch (e) {
                console.error('Error loading payer info:', e);
              }
            }
            
            // Map services for this group (service name = Name from service)
            const groupServices = group.services.map(s => ({
              ...s,
              editableName: s.name,
              editablePrice: s.clientPrice,
              editableClient: s.client || "",
            }));
            
            await createInvoiceForServices(groupServices, groupPayerInfo, invNum);
            successCount++;
          } catch (error: any) {
            console.error(`Error creating invoice for payer ${group.payerName}:`, error);
            const errorMessage = error?.message || error?.error || 'Unknown error';
            console.error(`Detailed error for ${group.payerName}:`, {
              error,
              message: errorMessage,
              payerName: group.payerName,
              servicesCount: group.services.length,
            });
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          alert(`✅ Created ${successCount} invoice(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}!`);
          onSuccess?.();
          onClose();
        } else {
          const errorDetails = errorCount > 0 
            ? `\n\nPlease check the browser console (F12) for detailed error messages.`
            : '';
          alert(`❌ Failed to create invoices. ${errorCount} error(s).${errorDetails}`);
        }
      } else {
        // Single payer - existing flow
        const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_number: invoiceNumber,
            payer_name: payerName,
            payer_party_id: payerPartyId,
            payer_type: payerType,
            payer_address: payerAddress,
            payer_email: payerEmail,
            payer_phone: payerPhone,
            payer_reg_nr: payerRegNr,
            payer_vat_nr: payerVatNr,
            payer_personal_code: payerPersonalCode,
            payer_bank_name: payerBankName,
            payer_bank_account: payerBankAccount,
            payer_bank_swift: payerBankSwift,
            invoice_date: invoiceDate,
            due_date: (dueDate && dueDate.trim() !== '') ? dueDate : null,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total,
            deposit_amount: calculatedDeposit || null,
            deposit_date: (depositDate && depositDate.trim() !== '') ? depositDate : null,
            final_payment_amount: (isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment) || null,
            final_payment_date: (finalPaymentDate && finalPaymentDate.trim() !== '') ? finalPaymentDate : null,
            status: 'draft',
            is_credit: isCredit,
            items: editableServices.map((s) => ({
              service_id: s.id,
              service_name: s.editableName,
              service_client: s.editableClient,
              service_date_from: s.dateFrom,
              service_date_to: s.dateTo,
              quantity: 1,
              unit_price: s.editablePrice,
              line_total: s.editablePrice,
            })),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create invoice');
        }

        setToastMessage('Invoice created successfully!');
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      alert(`Failed to create invoice: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // A4 aspect ratio: 210mm x 297mm = ~0.707
  const a4AspectRatio = 210 / 297;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full relative">
      {toastMessage && (
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}
      {/* LEFT PANEL: Payment Terms */}
      <div className="space-y-4 overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Create {invoiceType}
              {isCredit && <span className="ml-2 text-sm font-normal text-green-600">(Refund)</span>}
            </h2>
            {hasMultiplePayers && payerGroups.length > 1 && (
              <div className="mt-1 text-sm text-amber-600">
                Multiple payers detected: {payerGroups.length} invoice(s) will be created
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Multiple Payers Info */}
        {hasMultiplePayers && payerGroups.length > 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Services grouped by Payer:</h3>
            <div className="space-y-2">
              {payerGroups.map((group, idx) => (
                <div
                  key={group.payerKey}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    currentPayerIndex === idx
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCurrentPayerIndex(idx)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{group.payerName}</div>
                      <div className="text-xs text-gray-600">{group.services.length} service(s)</div>
                    </div>
                    <div className="text-xs font-semibold text-gray-700">
                      €{group.services.reduce((sum, s) => sum + s.clientPrice, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              Currently editing: <strong>{payerGroups[currentPayerIndex]?.payerName}</strong> ({currentPayerIndex + 1} of {payerGroups.length})
            </div>
          </div>
        )}

        {/* Payment Terms - with % support */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
          <h3 className="text-base font-semibold text-gray-900">Payment Terms</h3>
          <p className="text-sm text-gray-600">
            Payment terms are taken from the selected services and shown as a reference for setting the deposit and final payment.
          </p>
          {paymentTermsByService.length > 0 && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-2 border border-gray-100 space-y-1.5">
              {paymentTermsByService.map((item, i) => (
                <div key={i}>
                  <span className="font-medium text-gray-700">{item.category}: {item.name}</span>
                  <span className="text-gray-500 ml-1">€{item.sum.toLocaleString("en-US", { minimumFractionDigits: 2 })} — {item.paymentTerms}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Based on the payment terms above, we suggest the following payment plan:
          </p>

          {/* Deposit row: narrow amount; type in parentheses (double-click to change), then date */}
          <div className="grid grid-cols-[minmax(0,0.5fr)_minmax(200px,1fr)] gap-4 items-start">
            <div className="flex flex-col gap-1 relative">
              <label className="block text-sm font-medium text-gray-700">
                Deposit{" "}
                <span
                  data-type-trigger
                  role="button"
                  tabIndex={0}
                  title="Double-click to change type"
                  onDoubleClick={() => setShowTypePopover((s) => !s)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowTypePopover((s) => !s); } }}
                  className="cursor-pointer select-none rounded px-1 py-0.5 border border-transparent hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                >
                  ({depositType === "percent" ? "%" : "€"})
                </span>
              </label>
              {showTypePopover && (
                <div
                  ref={typePopoverRef}
                  className="absolute left-0 top-8 z-20 mt-0.5 rounded border border-gray-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => { setDepositType("percent"); setDepositValue(null); setShowTypePopover(false); }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDepositType("amount"); setDepositValue(null); setShowTypePopover(false); }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
                  >
                    Amount (€)
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  step={depositType === 'percent' ? "0.1" : "0.01"}
                  value={depositValue || ""}
                  onChange={(e) => setDepositValue(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-16 max-w-[72px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              {calculatedDeposit !== null && (
                <p className="text-sm text-gray-500">
                  = {formatCurrency(calculatedDeposit)}
                </p>
              )}
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Date</label>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    ref={depositDateInputRef}
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    aria-label="Deposit Date"
                  />
                  <button
                    type="button"
                    onClick={() => depositDateInputRef.current?.showPicker?.()}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm text-left text-gray-900 bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-[120px] shrink-0 flex items-center justify-between"
                  >
                    <span>{depositDate ? formatDateDDMMYYYY(depositDate) : "dd.mm.yyyy"}</span>
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[0, 1, 2].map((days) => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const value = `${yyyy}-${mm}-${dd}`;
                    const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : "Day after";
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setDepositDate(value)}
                        className={`px-2 py-1 text-sm rounded border transition-colors ${
                          depositDate === value
                            ? "bg-blue-100 border-blue-300 text-blue-800"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Final Payment row: % when deposit is %, else € (same type as deposit) */}
          <div className="grid grid-cols-[minmax(0,0.5fr)_minmax(200px,1fr)] gap-4 items-start">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isFullPayment ? (
                  "Full Payment (100%)"
                ) : (
                  <>
                    {depositType === "percent" ? "Final Payment " : "Final Payment Amount "}
                    <span
                      data-type-trigger
                      role="button"
                      tabIndex={0}
                      title="Double-click to change type"
                      onDoubleClick={() => setShowTypePopover((s) => !s)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowTypePopover((s) => !s); } }}
                      className="cursor-pointer select-none rounded px-1 py-0.5 border border-transparent hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                    >
                      ({depositType === "percent" ? "%" : "€"})
                    </span>
                  </>
                )}
              </label>
              {depositType === 'percent' ? (
                <>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={finalPaymentPercent != null ? finalPaymentPercent : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "" || raw === undefined) {
                        setDepositValue(null);
                        return;
                      }
                      const v = parseFloat(raw);
                      if (!isNaN(v) && v >= 0 && v <= 100) setDepositValue(100 - v);
                    }}
                    className="w-16 max-w-[72px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {calculatedFinalPayment != null && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      = {formatCurrency(calculatedFinalPayment)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="number"
                    step="0.01"
                    value={isFinalPaymentManual ? (finalPaymentAmount ?? "") : (calculatedFinalPayment ?? "")}
                    onChange={(e) => {
                      const value = e.target.value ? parseFloat(e.target.value) : null;
                      setFinalPaymentAmount(value);
                      setIsFinalPaymentManual(true);
                      if (value !== null && total > 0) {
                        const newDeposit = Math.round((total - value) * 100) / 100;
                        if (newDeposit >= 0) {
                          setDepositValue(newDeposit);
                          setDepositType('amount');
                        }
                      }
                    }}
                    onBlur={() => {
                      if (finalPaymentAmount === null && calculatedFinalPayment !== null) {
                        setIsFinalPaymentManual(false);
                        setFinalPaymentAmount(calculatedFinalPayment);
                      }
                    }}
                    className="w-24 max-w-[100px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {calculatedFinalPayment !== null && !isFinalPaymentManual && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      Auto-calculated: {formatCurrency(calculatedFinalPayment)}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isFullPayment ? "Full Payment Date" : "Final Payment Date"}
              </label>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    ref={finalPaymentDateInputRef}
                    type="date"
                    value={finalPaymentDate}
                    onChange={(e) => setFinalPaymentDate(e.target.value)}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    aria-label={isFullPayment ? "Full Payment Date" : "Final Payment Date"}
                  />
                  <button
                    type="button"
                    onClick={() => { const el = finalPaymentDateInputRef.current; (el as HTMLInputElement & { showPicker?: () => void })?.showPicker?.() ?? el?.click(); }}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm text-left text-gray-900 bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-[120px] shrink-0 flex items-center justify-between"
                  >
                    <span>{finalPaymentDate ? formatDateDDMMYYYY(finalPaymentDate) : "dd.mm.yyyy"}</span>
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                </div>
                {earliestServiceDate && (() => {
                  const start = new Date(earliestServiceDate + "T00:00:00");
                  const addDays = (d: Date, days: number) => {
                    const out = new Date(d);
                    out.setDate(out.getDate() - days);
                    return out;
                  };
                  const toYMD = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  const oneMonth = addDays(start, 32);
                  const twoWeeks = addDays(start, 16);
                  return (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setFinalPaymentDate(toYMD(oneMonth))}
                        className="px-2 py-1 text-sm rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                      >
                        1 month before
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalPaymentDate(toYMD(twoWeeks))}
                        className="px-2 py-1 text-sm rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                      >
                        2 weeks before
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {total > 0 && (calculatedFinalPayment !== null || isFullPayment) && (
            <div className="pt-2 border-t">
              <div className="text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-semibold">{formatCurrency(total)}</span>
                </div>
                {calculatedDeposit != null && calculatedDeposit > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Deposit:</span>
                      <span className="font-semibold">{formatCurrency(calculatedDeposit)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Remaining:</span>
                      <span>{formatCurrency(calculatedFinalPayment ?? 0)}</span>
                    </div>
                  </>
                )}
                {isFullPayment && (
                  <div className="flex justify-between font-semibold">
                    <span>Full Payment:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sticky bottom-0 bg-gray-50 p-3 -mx-2 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex-1 px-3 py-2 text-sm font-medium text-white rounded transition-colors disabled:opacity-50 ${
              isCredit ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSaving 
              ? (hasMultiplePayers && payerGroups.length > 1 ? 'Creating invoices...' : 'Saving...')
              : hasMultiplePayers && payerGroups.length > 1
                ? `Create ${payerGroups.length} Invoice(s)`
                : `Save ${invoiceType}`
            }
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Live Preview - A4 Aspect Ratio */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden flex flex-col">
        <div className="bg-gray-100 px-3 py-1.5 border-b flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Live Preview (A4)</span>
          <button
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            onClick={async () => {
              // This is a preview, so we can't export until invoice is saved
              alert('Please save the invoice first, then use Export PDF from the invoice list.');
            }}
          >
            Export PDF
          </button>
        </div>
        
        {/* A4 Container - maintains aspect ratio */}
        <div 
          className="flex-1 overflow-y-auto bg-white"
          style={{ 
            aspectRatio: `${a4AspectRatio}`,
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          <div className="p-6" style={{ minHeight: '100%' }}>
            {/* Invoice Header - Editable */}
            <div className="mb-6 border-b-2 border-gray-200 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-4">
                  {/* Logo in top left corner */}
                  {companyInfo?.logoUrl ? (
                    <div className="w-16 h-16 bg-white border border-gray-300 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img src={companyInfo.logoUrl} alt="Company Logo" className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-white border border-gray-300 rounded flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      Logo
                    </div>
                  )}
                  <h1 className={`text-3xl font-bold ${isCredit ? 'text-green-700' : 'text-gray-900'}`}>
                    {isCredit ? 'CREDIT NOTE' : 'INVOICE'}
                  </h1>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">Invoice #</div>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="text-sm font-semibold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none px-1 text-right"
                    placeholder="INV-..."
                  />
                </div>
              </div>
              {isCredit && (
                <div className="text-xs text-green-600 font-medium mb-2">Refund / Credit</div>
              )}
              <div className="flex items-center gap-6 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Date:</span>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none px-1"
                  />
                  <span className="text-gray-500">({formatDate(invoiceDate)})</span>
                </div>
              </div>
            </div>

            {/* Beneficiary/To Section - Modern Design */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="mb-2">
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Beneficiary</h3>
                    <div className="text-xs text-gray-900 space-y-1">
                      <div className="font-semibold text-sm">{companyInfo?.legalName || companyInfo?.name || "Legal Company Name"}</div>
                      {(companyInfo?.regNr || companyInfo?.vatNr) && (
                        <div className="text-gray-600">
                          {companyInfo?.regNr && <span>Reg. Nr: {companyInfo.regNr}</span>}
                          {companyInfo?.regNr && companyInfo?.vatNr && <span className="mx-1">•</span>}
                          {companyInfo?.vatNr && <span>PVN: {companyInfo.vatNr}</span>}
                        </div>
                      )}
                      <div className="text-gray-600">
                        {companyInfo?.legalAddress && <>{companyInfo.legalAddress}<br /></>}
                        {!companyInfo?.legalAddress && companyInfo?.address && <>{companyInfo.address}<br /></>}
                        {companyInfo?.country && <>{companyInfo.country}</>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payer</h3>
                <div className="text-xs text-gray-900 space-y-1">
                  <div className="font-semibold text-sm">{payerName || "-"}</div>
                  {payerType === 'company' && payerRegNr && (
                    <div className="text-gray-600">Reg. Nr: {payerRegNr}</div>
                  )}
                  {payerType === 'company' && payerVatNr && (
                    <div className="text-gray-600">VAT: {payerVatNr}</div>
                  )}
                  {payerType === 'person' && payerPersonalCode && (
                    <div className="text-gray-600">Personal Code: {payerPersonalCode}</div>
                  )}
                  {payerAddress && (
                    <div className="text-gray-600 whitespace-pre-line">{payerAddress}</div>
                  )}
                  {payerEmail && (
                    <div className="text-gray-600">{payerEmail}</div>
                  )}
                  {payerPhone && (
                    <div className="text-gray-600">{payerPhone}</div>
                  )}
                  {payerType === 'company' && payerBankName && (
                    <div className="text-gray-600 mt-1">
                      <div>Bank: {payerBankName}</div>
                      {payerBankAccount && <div>Account: {payerBankAccount}</div>}
                      {payerBankSwift && <div>SWIFT: {payerBankSwift}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Services Table - Editable */}
            <div className="mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left py-2 px-2 font-semibold text-gray-700">Dates</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-700">Service</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-700">Client</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {editableServices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-gray-400 italic">
                        No services selected
                      </td>
                    </tr>
                  ) : (
                    editableServices.map((service, idx) => (
                      <tr key={service.id} className={idx < editableServices.length - 1 ? "border-b border-gray-200" : ""}>
                        <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                          {service.dateFrom ? formatDate(service.dateFrom) : '-'}
                          {service.dateTo && service.dateTo !== service.dateFrom ? ` - ${formatDate(service.dateTo)}` : ''}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={service.editableName}
                            onChange={(e) => {
                              const updated = [...editableServices];
                              updated[idx].editableName = e.target.value;
                              setEditableServices(updated);
                            }}
                            className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none text-gray-900 break-words"
                            style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={service.editableClient}
                            onChange={(e) => {
                              const updated = [...editableServices];
                              updated[idx].editableClient = e.target.value;
                              setEditableServices(updated);
                            }}
                            className="w-full bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none text-gray-600"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={service.editablePrice}
                              onChange={(e) => {
                                const updated = [...editableServices];
                                updated[idx].editablePrice = parseFloat(e.target.value) || 0;
                                setEditableServices(updated);
                              }}
                              className="w-20 text-right bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none text-gray-900 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-gray-600">€</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals - Modern Design, Editable VAT */}
            <div className="flex justify-end mb-6">
              <div className="w-64 bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900 font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">VAT:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.1"
                      className="w-12 text-right bg-transparent border-b border-dashed border-gray-400 focus:border-blue-500 focus:outline-none text-gray-900 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-gray-600">%</span>
                    <span className="text-gray-900 font-semibold ml-2">
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold border-t-2 border-gray-400 pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Terms - Below Totals, hide Due Date if Payment Terms exist */}
            {(calculatedDeposit || isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment) || isFullPayment ? (
              <div className="mb-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Payment Terms</h4>
                <div className="space-y-1.5 text-xs">
                {calculatedDeposit && depositDate && (
                  <div className="flex justify-between text-gray-700">
                    <span>Deposit:</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedDeposit)} by {formatDate(depositDate)}
                    </span>
                  </div>
                )}
                {(isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment) && finalPaymentDate && (
                  <div className="flex justify-between text-gray-700">
                    <span>{isFullPayment ? "Full Payment:" : "Final Payment:"}</span>
                    <span className="font-semibold">
                      {formatCurrency(isFinalPaymentManual ? (finalPaymentAmount || 0) : (calculatedFinalPayment || 0))} by {formatDate(finalPaymentDate)}
                    </span>
                  </div>
                )}
                </div>
                {/* Banking Details under Payment Terms */}
                {(companyInfo?.bankName || companyInfo?.bankAccount || companyInfo?.bankSwift) && (
                  <div className="mt-3 pt-3 border-t border-amber-300">
                    <div className="text-xs font-semibold text-gray-700 uppercase mb-1.5">Banking Details</div>
                    <div className="space-y-0.5 text-xs text-gray-700">
                      {companyInfo?.bankName && <div>Bank: {companyInfo.bankName}</div>}
                      {companyInfo?.bankAccount && <div>Account: {companyInfo.bankAccount}</div>}
                      {companyInfo?.bankSwift && <div>SWIFT: {companyInfo.bankSwift}</div>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Show Due Date only if no Payment Terms */
              dueDate && (
                <div className="mb-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Due Date</h4>
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">{formatDate(dueDate)}</span>
                  </div>
                  {/* Banking Details under Due Date if no Payment Terms */}
                  {(companyInfo?.bankName || companyInfo?.bankAccount || companyInfo?.bankSwift) && (
                    <div className="mt-3 pt-3 border-t border-amber-300">
                      <div className="text-xs font-semibold text-gray-700 uppercase mb-1.5">Banking Details</div>
                      <div className="space-y-0.5 text-xs text-gray-700">
                        {companyInfo?.bankName && <div>Bank: {companyInfo.bankName}</div>}
                        {companyInfo?.bankAccount && <div>Account: {companyInfo.bankAccount}</div>}
                        {companyInfo?.bankSwift && <div>SWIFT: {companyInfo.bankSwift}</div>}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Footer */}
            <div className="mt-6 pt-3 border-t border-gray-200 text-xs text-gray-500 text-center">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
