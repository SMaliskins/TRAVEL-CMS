"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import SingleDatePicker from "@/components/SingleDatePicker";
import { useToast } from "@/contexts/ToastContext";

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
  hotelName?: string | null;
  hotelRoom?: string | null;
  hotelBoard?: string | null;
}

const PACKAGE_TOUR_BOARD_LABELS: Record<string, string> = {
  room_only: "Room Only",
  breakfast: "Breakfast",
  half_board: "Half Board",
  full_board: "Full Board",
  all_inclusive: "All Inclusive",
  uai: "UAI",
};

function formatPackageTourServiceName(s: Service): string {
  const country = "—";
  const hotelName = (s.hotelName ?? s.name ?? "").trim() || "—";
  const roomType = (s.hotelRoom ?? "").trim() || "—";
  const board = (s.hotelBoard ? PACKAGE_TOUR_BOARD_LABELS[String(s.hotelBoard)] ?? String(s.hotelBoard) : "").trim() || "—";
  return `Travel package to ${country}, ${hotelName}, ${roomType} room type, ${board} (boarding)`;
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
  defaultCurrency?: string;
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
  
  // Invoice language (from company settings)
  const [invoiceLanguages, setInvoiceLanguages] = useState<string[]>(["en"]);
  const [invoiceLanguage, setInvoiceLanguage] = useState<string>("en");

  // State for multiple invoices creation
  const [currentPayerIndex, setCurrentPayerIndex] = useState(0);
  const [payerGroups, setPayerGroups] = useState<Array<{ payerKey: string; payerName: string; services: Service[] }>>([]);

  // Payment terms per invoice when bulk creating (each invoice can have its own terms)
  type PaymentTermsSnapshot = {
    depositType: "amount" | "percent";
    depositValue: number | null;
    depositDate: string;
    finalPaymentAmount: number | null;
    finalPaymentDate: string;
    isFinalPaymentManual: boolean;
  };
  const [paymentTermsByPayerIndex, setPaymentTermsByPayerIndex] = useState<PaymentTermsSnapshot[]>([]);
  const paymentTermsFormRef = useRef<PaymentTermsSnapshot | null>(null);

  // Load company invoice languages on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list = Array.isArray(data?.company?.invoice_languages) ? data.company.invoice_languages : ["en"];
        if (list.length > 0 && !cancelled) {
          setInvoiceLanguages(list);
          setInvoiceLanguage((prev) => (list.includes(prev) ? prev : list[0]));
        }
      } catch {
        // keep default ["en"]
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Default payment terms from a payer's services (so second payer gets Deposit + Final Payment in invoice)
  const getDefaultTermsForServices = (services: Service[]): PaymentTermsSnapshot => {
    const today = new Date().toISOString().slice(0, 10);
    const base: PaymentTermsSnapshot = {
      depositType: "amount",
      depositValue: null,
      depositDate: today,
      finalPaymentAmount: null,
      finalPaymentDate: "",
      isFinalPaymentManual: false,
    };
    if (services.length === 0) return base;
    const withLargestSum = services.reduce((a, b) => (a.clientPrice >= b.clientPrice ? a : b));
    const terms = withLargestSum.paymentTerms?.trim();
    const percentMatch = terms ? (terms.match(/(\d+)\s*%\s*deposit/i) || terms.match(/deposit\s*(\d+)\s*%/i)) : null;
    const pct = percentMatch ? parseInt(percentMatch[1], 10) : null;
    if (pct != null && !isNaN(pct) && pct >= 0 && pct <= 100) {
      base.depositType = "percent";
      base.depositValue = pct;
    }
    const dateFroms = services.map((s) => s.dateFrom).filter(Boolean) as string[];
    if (dateFroms.length > 0) {
      const earliest = dateFroms.sort()[0];
      const d = new Date(earliest + "T00:00:00");
      d.setDate(d.getDate() - 14);
      base.finalPaymentDate =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    } else {
      // Fallback so invoice always has a final payment date (e.g. 30 days after deposit)
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() + 30);
      base.finalPaymentDate =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    return base;
  };

  // Initialize payer groups if multiple payers (each payer gets default terms from its services)
  useEffect(() => {
    if (hasMultiplePayers && servicesByPayer) {
      const groups: Array<{ payerKey: string; payerName: string; services: Service[] }> = [];
      servicesByPayer.forEach((services, payerKey) => {
        const payerName = services[0]?.payer?.trim() || 'Unknown Payer';
        groups.push({ payerKey, payerName, services });
      });
      setPayerGroups(groups);
      setPaymentTermsByPayerIndex(groups.map((g) => getDefaultTermsForServices(g.services)));
      if (groups.length > 0) {
        setCurrentPayerIndex(0);
      }
    } else {
      setPayerGroups([]);
      setPaymentTermsByPayerIndex([]);
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
  
  // Generate invoice number: NNNYY-INITIALS-NNNN format (single)
  const generateInvoiceNumber = async (suffix?: string): Promise<string> => {
    const numbers = await generateInvoiceNumbers(1);
    const baseNumber = numbers[0];
    return suffix ? `${baseNumber}-${suffix}` : baseNumber;
  };

  // Generate multiple invoice numbers in one call (for bulk — guarantees unique consecutive numbers)
  const generateInvoiceNumbers = async (count: number): Promise<string[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url = count <= 1
        ? `/api/orders/${encodeURIComponent(orderCode)}/invoices?nextNumber=true`
        : `/api/orders/${encodeURIComponent(orderCode)}/invoices?nextNumber=true&count=${count}`;
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to get invoice number from API');
      }
      const data = await response.json();
      if (count <= 1) {
        const baseNumber = data.nextInvoiceNumber;
        if (!baseNumber) throw new Error('No invoice number returned from API');
        return [baseNumber];
      }
      const nextInvoiceNumbers = data.nextInvoiceNumbers as string[] | undefined;
      if (!Array.isArray(nextInvoiceNumbers) || nextInvoiceNumbers.length < count) {
        throw new Error('Insufficient invoice numbers returned from API');
      }
      return nextInvoiceNumbers.slice(0, count);
    } catch (e: any) {
      console.error('Error generating invoice numbers:', e);
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const fallback: string[] = [];
      for (let i = 0; i < count; i++) {
        fallback.push(`INV-${orderCode.replace(/\//g, '-').toUpperCase()}-${currentYear}-XX-${String(Date.now() + i).slice(-4)}`);
      }
      return fallback;
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
  const [showTypePopover, setShowTypePopover] = useState(false);
  const typePopoverRef = useRef<HTMLDivElement>(null);

  // Helper: current form as PaymentTermsSnapshot (for bulk: save/restore per payer)
  const currentFormAsTerms = (): PaymentTermsSnapshot => ({
    depositType,
    depositValue,
    depositDate,
    finalPaymentAmount,
    finalPaymentDate,
    isFinalPaymentManual,
  });

  // When switching payer: save current form to snapshot, then load snapshot for new payer
  const handleSwitchPayer = (idx: number) => {
    if (idx === currentPayerIndex) return;
    setPaymentTermsByPayerIndex((prev) => {
      const next = [...prev];
      next[currentPayerIndex] = currentFormAsTerms();
      return next;
    });
    setCurrentPayerIndex(idx);
  };

  // Load form from payment terms snapshot when payer changes or snapshots are initialized (bulk mode)
  useEffect(() => {
    if (!hasMultiplePayers || payerGroups.length <= 1 || paymentTermsByPayerIndex.length === 0) return;
    const snap = paymentTermsByPayerIndex[currentPayerIndex];
    if (!snap) return;
    const today = new Date().toISOString().slice(0, 10);
    setDepositType(snap.depositType);
    setDepositValue(snap.depositValue);
    setDepositDate(snap.depositDate || today);
    setFinalPaymentAmount(snap.finalPaymentAmount);
    setFinalPaymentDate(snap.finalPaymentDate);
    setIsFinalPaymentManual(snap.isFinalPaymentManual);
  }, [currentPayerIndex, paymentTermsByPayerIndex, hasMultiplePayers, payerGroups.length]);

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

  // Load invoice number on mount (only for single-invoice mode; bulk reserves at create time)
  useEffect(() => {
    if (hasMultiplePayers && servicesByPayer && servicesByPayer.size > 1) return;
    generateInvoiceNumber().then(setInvoiceNumber);
  }, [orderCode, hasMultiplePayers, servicesByPayer]);

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
            defaultCurrency: data.defaultCurrency || "EUR",
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

  const currencyCode = companyInfo?.defaultCurrency || "EUR";
  const currencySymbol = (() => {
    try {
      const parts = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode, currencyDisplay: "symbol" }).formatToParts(0);
      return parts.find((p) => p.type === "currency")?.value ?? currencyCode;
    } catch {
      return currencyCode;
    }
  })();

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      const absAmount = Math.abs(amount);
      const formatted = `${currencySymbol}${absAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return amount < 0 ? `-${formatted}` : formatted;
    }
  };

  const formatDate = (dateString: string) => formatDateDDMMYYYY(dateString || null);

  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

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

  // In bulk mode: total for current payer only (so preview is correct before editableServices syncs)
  const previewTotalForPayer = useMemo(() => {
    if (!hasMultiplePayers || payerGroups.length <= 1) return null;
    const group = payerGroups[currentPayerIndex];
    if (!group?.services?.length) return 0;
    const sum = group.services.reduce((s, svc) => s + (svc.clientPrice ?? 0), 0);
    return sum + Math.round((sum * taxRate / 100) * 100) / 100;
  }, [hasMultiplePayers, payerGroups, currentPayerIndex, taxRate]);

  // In bulk mode: preview Payment Terms from snapshot so 2nd/3rd payer always show correct block (no form sync lag)
  const previewTerms = useMemo(() => {
    if (!hasMultiplePayers || payerGroups.length <= 1 || paymentTermsByPayerIndex.length === 0) return null;
    const snap = paymentTermsByPayerIndex[currentPayerIndex];
    if (!snap) return null;
    const t = previewTotalForPayer != null ? previewTotalForPayer : total;
    const dep =
      snap.depositType === "percent" && snap.depositValue != null
        ? Math.round((t * snap.depositValue / 100) * 100) / 100
        : snap.depositValue ?? null;
    const calcFinal = dep != null ? Math.round((t - dep) * 100) / 100 : t;
    const fullPay = t > 0 && (dep == null || dep === 0);
    return {
      depositAmount: dep,
      depositDate: snap.depositDate?.trim() || null,
      finalPaymentAmount: snap.isFinalPaymentManual ? (snap.finalPaymentAmount ?? null) : calcFinal,
      finalPaymentDate: snap.finalPaymentDate?.trim() || null,
      isFullPayment: fullPay,
    };
  }, [hasMultiplePayers, payerGroups.length, paymentTermsByPayerIndex, currentPayerIndex, total, previewTotalForPayer]);


  // Default deposit from service with largest sum (parse "10% deposit, 90% final") — once per payer when services have terms
  const defaultDepositAppliedForPayerIndices = React.useRef<Set<number>>(new Set());
  useEffect(() => {
    const svc = serviceWithLargestSum;
    if (!svc?.paymentTerms?.trim() || defaultDepositAppliedForPayerIndices.current.has(currentPayerIndex)) return;
    const terms = svc.paymentTerms.trim();
    const percentMatch = terms.match(/(\d+)\s*%\s*deposit/i) || terms.match(/deposit\s*(\d+)\s*%/i);
    const pct = percentMatch ? parseInt(percentMatch[1], 10) : null;
    if (pct != null && !isNaN(pct) && pct >= 0 && pct <= 100) {
      setDepositType("percent");
      setDepositValue(pct);
      defaultDepositAppliedForPayerIndices.current.add(currentPayerIndex);
      setPaymentTermsByPayerIndex((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const snap = next[currentPayerIndex];
        if (snap) next[currentPayerIndex] = { ...snap, depositType: "percent", depositValue: pct };
        return next;
      });
    }
  }, [serviceWithLargestSum, currentPayerIndex]);

  const createInvoiceForServices = async (
    services: typeof editableServices,
    payerInfo: {
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
    },
    invoiceNum: string,
    termsOverride?: PaymentTermsSnapshot
  ) => {
    const servicesSubtotal = services.reduce((sum, s) => sum + s.editablePrice, 0);
    const servicesTaxAmount = Math.round((servicesSubtotal * taxRate / 100) * 100) / 100;
    const servicesTotal = servicesSubtotal + servicesTaxAmount;

    let deposit_amount: number | null;
    let deposit_date: string | null;
    let final_payment_amount: number | null;
    let final_payment_date: string | null;
    if (termsOverride) {
      const dep =
        termsOverride.depositType === "percent" && termsOverride.depositValue != null
          ? Math.round((servicesTotal * termsOverride.depositValue / 100) * 100) / 100
          : termsOverride.depositValue ?? null;
      const calcFinal = dep != null ? Math.round((servicesTotal - dep) * 100) / 100 : servicesTotal;
      deposit_amount = dep;
      deposit_date = termsOverride.depositDate?.trim() ? termsOverride.depositDate : null;
      final_payment_amount = termsOverride.isFinalPaymentManual
        ? (termsOverride.finalPaymentAmount ?? null)
        : calcFinal;
      final_payment_date = termsOverride.finalPaymentDate?.trim() ? termsOverride.finalPaymentDate : null;
    } else {
      deposit_amount = calculatedDeposit || null;
      deposit_date = depositDate?.trim() ? depositDate : null;
      final_payment_amount = (isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment) || null;
      final_payment_date = finalPaymentDate?.trim() ? finalPaymentDate : null;
    }

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
        deposit_amount,
        deposit_date,
        final_payment_amount,
        final_payment_date,
        status: 'draft',
        is_credit: servicesTotal < 0,
        language: invoiceLanguage || "en",
        items: services.map((s) => ({
          service_id: s.id,
          service_name: (s.category?.toLowerCase().trim() === "package tour" || s.category?.toLowerCase().trim() === "tour") ? formatPackageTourServiceName(s) : s.editableName,
          service_client: s.editableClient,
          service_date_from: s.dateFrom,
          service_date_to: s.dateTo,
          quantity: 1,
          unit_price: s.editablePrice,
          line_total: s.editablePrice,
        })),
      }),
    });

    const rawText = await response.text();
    if (!response.ok) {
      let errorMessage = 'Failed to create invoice';
      try {
        const error = rawText ? JSON.parse(rawText) : {};
        errorMessage = error.error || error.message || errorMessage;
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: error,
          raw: rawText?.slice(0, 500),
        });
      } catch (e) {
        console.error('Failed to parse error response:', e);
        errorMessage = `HTTP ${response.status}: ${response.statusText}${rawText ? ` — ${rawText.slice(0, 200)}` : ''}`;
      }
      if (errorMessage === 'Failed to create invoice' && rawText) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}. ${rawText.slice(0, 300)}`;
      } else if (errorMessage === 'Failed to create invoice') {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return rawText ? JSON.parse(rawText) : {};
  };

  const handleSave = async () => {
    if (!payerName.trim()) {
      alert('Please enter payer name');
      return;
    }

    if (editableServices.length === 0) {
      showToast("error", "Please select at least one service");
      return;
    }

    setIsSaving(true);
    try {
      if (hasMultiplePayers && payerGroups.length > 1) {
        // Create invoices for all payer groups (each with its own payment terms).
        // Reserve one invoice number per invoice at create time (no upfront reserve — avoids wasting numbers if user cancels).
        const termsForBulk = paymentTermsByPayerIndex.map((snap, i) =>
          i === currentPayerIndex ? currentFormAsTerms() : snap
        );
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < payerGroups.length; i++) {
          const group = payerGroups[i];
          let invNum: string;
          try {
            invNum = await generateInvoiceNumber();
            if (!invNum) throw new Error('Failed to get invoice number');
          } catch (numErr: any) {
            console.error('Error getting invoice number:', numErr);
            errorCount++;
            continue;
          }
          try {
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
            
            await createInvoiceForServices(groupServices, groupPayerInfo, invNum, termsForBulk[i]);
            successCount++;
          } catch (error: any) {
            const errorMessage = error?.message || error?.error || 'Unknown error';
            console.error(`Error creating invoice for payer ${group.payerName}:`, errorMessage);
            console.error(`Detailed error for ${group.payerName}:`, {
              errorMessage,
              payerName: group.payerName,
              servicesCount: group.services.length,
            });
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          showToast("success", `Created ${successCount} invoice(s)${errorCount > 0 ? `, ${errorCount} failed` : ""}!`);
          onSuccess?.();
          onClose();
        } else {
          const errorDetails = errorCount > 0 
            ? `\n\nPlease check the browser console (F12) for detailed error messages.`
            : '';
          showToast("error", `Failed to create invoices. ${errorCount} error(s). ${errorDetails}`);
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
            language: invoiceLanguage || "en",
            items: editableServices.map((s) => ({
              service_id: s.id,
              service_name: (s.category?.toLowerCase().trim() === "package tour" || s.category?.toLowerCase().trim() === "tour") ? formatPackageTourServiceName(s) : s.editableName,
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
          const rawText = await response.text();
          let errMsg = 'Failed to create invoice';
          try {
            const error = rawText ? JSON.parse(rawText) : {};
            errMsg = error.error || error.message || errMsg;
            console.error('API Error (single invoice):', { status: response.status, statusText: response.statusText, body: error, raw: rawText?.slice(0, 500) });
          } catch (_) {
            errMsg = `HTTP ${response.status}: ${response.statusText}${rawText ? ` — ${rawText.slice(0, 200)}` : ''}`;
          }
          throw new Error(errMsg);
        }

        setToastMessage('Invoice created successfully!');
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      showToast("error", `Failed to create invoice: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // A4 aspect ratio: 210mm x 297mm = ~0.707
  const a4AspectRatio = 210 / 297;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full relative">
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
                  onClick={() => handleSwitchPayer(idx)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{group.payerName}</div>
                      <div className="text-xs text-gray-600">{group.services.length} service(s)</div>
                    </div>
                    <div className="text-xs font-semibold text-gray-700">
                      {formatCurrency(group.services.reduce((sum, s) => sum + s.clientPrice, 0))}
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

        {/* Invoice language — always shown so user can switch language when creating invoice */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <label htmlFor="invoice-language" className="block text-sm font-medium text-gray-700 mb-1">Invoice language</label>
          <select
            id="invoice-language"
            value={invoiceLanguage}
            onChange={(e) => setInvoiceLanguage(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            title="Language of the invoice document"
          >
            {invoiceLanguages.map((code) => (
              <option key={code} value={code}>
                {code === "en" ? "English" : code === "lv" ? "Latvian" : code === "ru" ? "Russian" : code === "de" ? "German" : code === "fr" ? "French" : code === "es" ? "Spanish" : code}
              </option>
            ))}
          </select>
        </div>

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
                  <span className="text-gray-500 ml-1">{formatCurrency(item.sum)} — {item.paymentTerms}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Based on the payment terms above, we suggest the following payment plan:
          </p>

          {/* Deposit row: Deposit (%) | (€) | Deposit Date — one row of labels, one row of inputs */}
          <div className="grid grid-cols-[minmax(0,0.5fr)_auto_minmax(200px,1fr)] gap-4 items-start">
            <div className="flex flex-col gap-1 relative">
              <label className="block text-sm font-medium text-gray-700">
                Deposit
                <span
                  data-type-trigger
                  role="button"
                  tabIndex={0}
                  title="Double-click to change type"
                  onDoubleClick={() => setShowTypePopover((s) => !s)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowTypePopover((s) => !s); } }}
                  className="cursor-pointer select-none rounded px-1 py-0.5 border border-transparent hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                >
                  ({depositType === "percent" ? "%" : currencySymbol})
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
                    Amount ({currencySymbol})
                  </button>
                </div>
              )}
              {depositType === "percent" ? (
                <div className="inline-flex w-12 max-w-[52px] items-center rounded border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-0 focus-within:border-blue-500">
                  <input
                    type="number"
                    step="0.1"
                    value={depositValue || ""}
                    onChange={(e) => setDepositValue(e.target.value ? parseFloat(e.target.value) : null)}
                    className="min-w-0 flex-1 w-5 py-1.5 pl-1.5 pr-0 border-0 bg-transparent text-sm focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm text-gray-500 pr-1 shrink-0">%</span>
                </div>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  value={depositValue || ""}
                  onChange={(e) => setDepositValue(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-16 max-w-[72px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            </div>
            {(calculatedDeposit !== null || (depositType === "amount" && depositValue != null && total > 0)) ? (
              <div className="flex flex-col gap-0.5 justify-end pb-1.5">
                <label className="text-sm text-gray-500">
                  {depositType === "percent" ? `Amount (${currencySymbol})` : "Percentage (%)"}
                </label>
                <div className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 min-h-[34px] flex items-center">
                  {depositType === "percent"
                    ? formatCurrency(calculatedDeposit ?? 0)
                    : total > 0 && depositValue != null
                      ? `${(Math.round((depositValue / total) * 1000) / 10).toFixed(1)}%`
                      : ""}
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="min-w-0">
              <SingleDatePicker
                label="Deposit Date"
                value={depositDate || undefined}
                onChange={(v) => setDepositDate(v ?? "")}
                placeholder="dd.mm.yyyy"
                shortcutPresets={["today", "tomorrow", "dayAfter"]}
              />
            </div>
          </div>

          {/* Final Payment row: Final Payment (%)/Amount ({currencySymbol}) | (€) | Final Payment Date — one row of labels */}
          <div className="grid grid-cols-[minmax(0,0.5fr)_auto_minmax(200px,1fr)] gap-4 items-start">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isFullPayment ? (
                  "Full Payment (100%)"
                ) : (
                  <>
                    {depositType === "percent" ? "Final Payment" : "Final Payment Amount"}
                    <span
                      data-type-trigger
                      role="button"
                      tabIndex={0}
                      title="Double-click to change type"
                      onDoubleClick={() => setShowTypePopover((s) => !s)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowTypePopover((s) => !s); } }}
                      className="cursor-pointer select-none rounded px-1 py-0.5 border border-transparent hover:border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                    >
                      ({depositType === "percent" ? "%" : currencySymbol})
                    </span>
                  </>
                )}
              </label>
              {depositType === 'percent' ? (
                <div className="inline-flex w-12 max-w-[52px] items-center rounded border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-0 focus-within:border-blue-500">
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
                    className="min-w-0 flex-1 w-5 py-1.5 pl-1.5 pr-0 border-0 bg-transparent text-sm focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm text-gray-500 pr-1 shrink-0">%</span>
                </div>
              ) : (
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
                  className="w-16 max-w-[72px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            </div>
            {(calculatedFinalPayment !== null || (depositType === "amount" && total > 0 && (finalPaymentAmount != null || calculatedFinalPayment != null))) ? (
              <div className="flex flex-col gap-0.5 justify-end pb-1.5">
                <label className="text-sm text-gray-500">
                  {depositType === "percent" ? `Amount (${currencySymbol})` : "Percentage (%)"}
                </label>
                <div className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 min-h-[34px] flex items-center">
                  {depositType === "percent"
                    ? formatCurrency(isFinalPaymentManual ? (finalPaymentAmount ?? 0) : (calculatedFinalPayment ?? 0))
                    : (() => {
                        const fp = isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment;
                        return total > 0 && fp != null ? `${(Math.round((fp / total) * 1000) / 10).toFixed(1)}%` : "";
                      })()}
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="min-w-0">
              <SingleDatePicker
                label={isFullPayment ? "Full Payment Date" : "Final Payment Date"}
                value={finalPaymentDate || undefined}
                onChange={(v) => setFinalPaymentDate(v ?? "")}
                placeholder="dd.mm.yyyy"
                shortcutPresets={["today", "tomorrow", "dayAfter"]}
                relativeToDate={earliestServiceDate ?? undefined}
              />
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
              showToast("error", "Please save the invoice first, then use Export PDF from the invoice list.");
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
                  {hasMultiplePayers && payerGroups.length > 1 ? (
                    <div className="text-sm font-semibold text-gray-600 text-right">
                      {payerGroups.length} numbers assigned when you create
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="text-sm font-semibold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none px-1 text-right"
                      placeholder="INV-..."
                    />
                  )}
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
                            <span className="text-gray-600">{currencySymbol}</span>
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
            {(() => {
              const usePreview = hasMultiplePayers && payerGroups.length > 1 && previewTerms;
              const showBlock = usePreview
                ? (previewTerms!.depositAmount || previewTerms!.finalPaymentAmount || previewTerms!.isFullPayment)
                : ((calculatedDeposit || isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment) || isFullPayment);
              const dep = usePreview ? previewTerms!.depositAmount : calculatedDeposit;
              const depDate = usePreview ? previewTerms!.depositDate : depositDate;
              const fpAmount = usePreview ? previewTerms!.finalPaymentAmount : (isFinalPaymentManual ? finalPaymentAmount : calculatedFinalPayment);
              const fpDate = usePreview ? previewTerms!.finalPaymentDate : finalPaymentDate;
              const fullPay = usePreview ? previewTerms!.isFullPayment : isFullPayment;
              const totalForDisplay = usePreview && previewTotalForPayer != null ? previewTotalForPayer : total;
              return showBlock ? (
              <div className="mb-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Payment Terms</h4>
                <div className="space-y-1.5 text-xs">
                {dep && depDate && (
                  <div className="flex justify-between text-gray-700">
                    <span>Deposit:</span>
                    <span className="font-semibold">
                      {formatCurrency(dep)} by {formatDate(depDate)}
                    </span>
                  </div>
                )}
                {(fpAmount || fullPay) && fpDate && (
                  <div className="flex justify-between text-gray-700">
                    <span>{fullPay ? "Full Payment:" : "Final Payment:"}</span>
                    <span className="font-semibold">
                      {formatCurrency(fpAmount ?? totalForDisplay)} by {formatDate(fpDate)}
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
            );
            })()}

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
