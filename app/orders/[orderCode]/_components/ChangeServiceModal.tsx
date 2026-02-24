'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FlightSegment } from '@/components/FlightItineraryInput';
import { parseFlightBooking, getAirportTimezoneOffset } from '@/lib/flights/airlineParsers';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { formatDateDDMMYYYY, formatDateShort } from '@/utils/dateFormat';

interface Service {
  id: string;
  name: string;
  category: string;
  servicePrice: number;
  clientPrice: number;
  resStatus: string | null;
  refNr?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  supplier?: string | null;
  supplierPartyId?: string | null;
  client?: string | null;
  clientPartyId?: string | null;
  payer?: string | null;
  payerPartyId?: string | null;
  flightSegments?: FlightSegment[];
  ticketNumbers?: Array<{ clientId: string; clientName: string; ticketNr: string }>;
  assignedTravellerIds?: string[];
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  baggage?: string;
}

interface ChangeServiceModalProps {
  service: Service;
  orderCode: string;
  onClose: () => void;
  onChangeConfirmed: () => void;
}

export default function ChangeServiceModal({
  service,
  orderCode,
  onClose,
  onChangeConfirmed,
}: ChangeServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Segment selection
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(new Set());
  
  // New flight data
  const [newSegments, setNewSegments] = useState<FlightSegment[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newDateFrom, setNewDateFrom] = useState<string>('');
  const [newDateTo, setNewDateTo] = useState<string>('');
  const [newCabinClass, setNewCabinClass] = useState<"economy" | "premium_economy" | "business" | "first">(service.cabinClass || "economy");
  const [newBaggage, setNewBaggage] = useState(service.baggage || '');
  
  // Fees
  const [changeFee, setChangeFee] = useState<string>('');
  const [marge, setMarge] = useState<string>('');
  const [clientPrice, setClientPrice] = useState<string>('');
  
  // Track which field was last edited to determine calculation direction
  const lastEditedRef = useRef<'fee' | 'marge' | 'clientPrice' | null>(null);
  
  // Paste & Parse
  const [pasteInput, setPasteInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEscapeKey(onClose);
  
  // Auto-calculate logic for Change Fee, Marge, and Client Price
  useEffect(() => {
    if (!lastEditedRef.current) return;
    
    // Parse and round to 2 decimal places to avoid floating point errors
    const fee = Math.round((parseFloat(changeFee) || 0) * 100) / 100;
    const margeVal = Math.round((parseFloat(marge) || 0) * 100) / 100;
    const clientPriceVal = Math.round((parseFloat(clientPrice) || 0) * 100) / 100;
    
    if (lastEditedRef.current === 'fee' || lastEditedRef.current === 'marge') {
      // If Fee or Marge changed, calculate Client Price
      const calculatedClientPrice = Math.round((fee + margeVal) * 100) / 100;
      const calculatedClientPriceRounded = parseFloat(calculatedClientPrice.toFixed(2));
      if (Math.abs(calculatedClientPriceRounded - clientPriceVal) > 0.001) {
        lastEditedRef.current = null; // Prevent re-trigger
        setClientPrice(calculatedClientPriceRounded.toFixed(2));
      }
    } else if (lastEditedRef.current === 'clientPrice') {
      // If Client Price changed, calculate Marge
      const calculatedMarge = Math.round((clientPriceVal - fee) * 100) / 100;
      const calculatedMargeRounded = parseFloat(calculatedMarge.toFixed(2));
      if (Math.abs(calculatedMargeRounded - margeVal) > 0.001) {
        lastEditedRef.current = null; // Prevent re-trigger
        setMarge(calculatedMargeRounded.toFixed(2));
      }
    }
  }, [changeFee, marge, clientPrice]);
  
  // Apply segments to form (shared by AI and regex) — route with full city names: "date city - city / date city - city"
  const applySegments = useCallback((segments: FlightSegment[], booking: Record<string, unknown>) => {
    setNewSegments(segments);
    const groupedByDate: Record<string, FlightSegment[]> = {};
    segments.forEach((seg) => {
      const date = seg.departureDate || "unknown";
      if (!groupedByDate[date]) groupedByDate[date] = [];
      groupedByDate[date].push(seg);
    });
    const routeParts = Object.entries(groupedByDate).map(([, segs]) => {
      const dateStr = formatDateShort(segs[0]?.departureDate || "");
      const cities = [
        segs[0].departureCity?.trim() || segs[0].departure || "",
        ...segs.map(s => (s.arrivalCity?.trim() || s.arrival || "")),
      ].filter(Boolean);
      const routeStr = cities.join(" - ");
      return dateStr && dateStr !== "-" ? `${dateStr} ${routeStr}` : routeStr;
    });
    setNewServiceName(routeParts.join(" / "));
    if (segments.length > 0) {
      setNewDateFrom(segments[0].departureDate || '');
      setNewDateTo(segments[segments.length - 1].arrivalDate || segments[segments.length - 1].departureDate || '');
    }
    if (booking.cabinClass) {
      const validClasses = ["economy", "premium_economy", "business", "first"];
      if (validClasses.includes(booking.cabinClass as string)) {
        setNewCabinClass(booking.cabinClass as typeof newCabinClass);
      }
    }
    if (booking.baggage) setNewBaggage(booking.baggage as string);
    setParseSuccess(true);
    setPasteInput('');
  }, []);

  // Parse flight booking data — try AI first, fallback to regex
  const handleParse = useCallback(async () => {
    if (!pasteInput.trim()) return;
    
    setIsParsing(true);
    setParseError(null);
    setParseSuccess(false);
    const text = pasteInput.trim();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai/parse-flight-itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      
      if (res.ok && data.segments?.length > 0) {
        applySegments(data.segments, data.booking || {});
        return;
      }
    } catch (e) {
      console.error('AI flight parse error:', e);
    } finally {
      setIsParsing(false);
    }
    
    const result = parseFlightBooking(text);
    if (!result || result.segments.length === 0) {
      setParseError('Could not parse flight data. Please check the format.');
      return;
    }
    
    const segments: FlightSegment[] = result.segments.map(seg => ({
      id: crypto.randomUUID(),
      flightNumber: seg.flightNumber,
      airline: seg.airline,
      departure: seg.departure || "",
      departureCity: seg.departureCity,
      arrival: seg.arrival || "",
      arrivalCity: seg.arrivalCity,
      departureDate: seg.departureDate || "",
      departureTimeScheduled: seg.departureTimeScheduled || "",
      arrivalDate: seg.arrivalDate || "",
      arrivalTimeScheduled: seg.arrivalTimeScheduled || "",
      departureTerminal: seg.departureTerminal,
      arrivalTerminal: seg.arrivalTerminal,
      duration: seg.duration,
      cabinClass: seg.cabinClass,
      baggage: seg.baggage,
      bookingRef: seg.bookingRef,
      ticketNumber: seg.ticketNumber,
      departureStatus: "scheduled",
      arrivalStatus: "scheduled",
    }));
    applySegments(segments, {
      cabinClass: result.booking.cabinClass,
      baggage: result.booking.baggage,
    });
    setIsParsing(false);
  }, [pasteInput, applySegments]);
  
  // Handle file drop
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setPasteInput(text);
    }
  }, []);
  
  // Toggle segment selection
  const toggleSegmentSelection = (segmentId: string) => {
    setSelectedSegmentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  };
  
  // Helper function to format segments for service name
  const formatSegmentsForName = (segments: FlightSegment[], includeFlightNumber: boolean = false): string => {
    if (segments.length === 0) return '';
    
    const routeParts: string[] = [];
    let currentDate = '';
    
    segments.forEach((seg) => {
      const dateStr = seg.departureDate ? formatDateDDMMYYYY(seg.departureDate) : '';
      if (dateStr && dateStr !== '-' && dateStr !== currentDate) {
        if (routeParts.length > 0) routeParts.push('/');
        routeParts.push(dateStr);
        currentDate = dateStr;
      }
      
      const route = includeFlightNumber && seg.flightNumber 
        ? `${seg.flightNumber} ${seg.departure || ""}-${seg.arrival || ""}`
        : `${seg.departure || ""}-${seg.arrival || ""}`;
      routeParts.push(route);
    });
    
    return routeParts.join(' ');
  };
  
  // Submit change
  const handleSubmit = async () => {
    if (selectedSegmentIds.size === 0) {
      setError('Please select at least one segment to change');
      return;
    }
    
    if (selectedSegmentIds.size > 0 && newSegments.length === 0) {
      setError('Please parse new flight data for selected segments');
      return;
    }
    
    if (!changeFee && !clientPrice) {
      setError('Please enter Change Fee or Client Price');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const originalSegments = service.flightSegments || [];
      
      // Get selected segments (old ones that will be replaced)
      const selectedOldSegments: FlightSegment[] = [];
      const remainingSegments: FlightSegment[] = [];
      
      originalSegments.forEach((seg, idx) => {
        const segmentId = seg.id || `seg-${idx}-${seg.flightNumber}-${seg.departure}-${seg.arrival}`;
        if (selectedSegmentIds.has(segmentId)) {
          selectedOldSegments.push({
            ...seg,
            id: seg.id || segmentId,
          });
        } else {
          remainingSegments.push({
            ...seg,
            id: seg.id || segmentId,
          });
        }
      });
      
      // Check if change is within the same day (all old and new segments on same date)
      const oldDates = new Set(selectedOldSegments.map(s => s.departureDate).filter(Boolean));
      const newDates = new Set(newSegments.map(s => s.departureDate).filter(Boolean));
      const isSameDayChange = oldDates.size === 1 && newDates.size === 1 && 
        Array.from(oldDates)[0] === Array.from(newDates)[0];
      
      // Build change service name: "Change: old -> new"
      // Format: "01.02 NCE-FRA/ 01.02 FRA-TLL -> 02.02 NCE-FRA/ 02.02 FRA-TLL"
      // Or with flight numbers if same day: "01.02 LH881 NCE-FRA/ 01.02 LH1064 FRA-TLL -> 01.02 AY6262 NCE-FRA/ 02.02 AY2627 FRA-TLL"
      const oldSegmentsName = formatSegmentsForName(selectedOldSegments, isSameDayChange);
      const newSegmentsName = formatSegmentsForName(newSegments, isSameDayChange);
      const changeServiceName = `Change: ${oldSegmentsName} → ${newSegmentsName}`;
      
      // Calculate dates for updated original service (only remaining segments)
      const updatedOriginalSegments = [...remainingSegments].sort((a, b) => {
        const dateA = a.departureDate ? new Date(a.departureDate + 'T' + a.departureTimeScheduled).getTime() : 0;
        const dateB = b.departureDate ? new Date(b.departureDate + 'T' + b.departureTimeScheduled).getTime() : 0;
        return dateA - dateB;
      });
      
      const updatedOriginalDateFrom = updatedOriginalSegments.length > 0 
        ? updatedOriginalSegments[0].departureDate || null 
        : null;
      const updatedOriginalDateTo = updatedOriginalSegments.length > 0 
        ? (updatedOriginalSegments[updatedOriginalSegments.length - 1].arrivalDate || 
           updatedOriginalSegments[updatedOriginalSegments.length - 1].departureDate || null)
        : null;
      
      // Build updated original service name
      const updatedOriginalName = formatSegmentsForName(updatedOriginalSegments, false);
      
      // Calculate dates for new change service (only new segments)
      const sortedNewSegments = [...newSegments].sort((a, b) => {
        const dateA = a.departureDate ? new Date(a.departureDate + 'T' + a.departureTimeScheduled).getTime() : 0;
        const dateB = b.departureDate ? new Date(b.departureDate + 'T' + b.departureTimeScheduled).getTime() : 0;
        return dateA - dateB;
      });
      
      const newServiceDateFrom = sortedNewSegments.length > 0 
        ? sortedNewSegments[0].departureDate || null 
        : null;
      const newServiceDateTo = sortedNewSegments.length > 0 
        ? (sortedNewSegments[sortedNewSegments.length - 1].arrivalDate || 
           sortedNewSegments[sortedNewSegments.length - 1].departureDate || null)
        : null;
      
      // 1. Update original service: remove selected segments, update dates and name
      const updateOriginalPayload: Record<string, unknown> = {
        res_status: 'changed',
        flight_segments: updatedOriginalSegments,
        service_date_from: updatedOriginalDateFrom,
        service_date_to: updatedOriginalDateTo,
      };
      
      if (updatedOriginalName) {
        updateOriginalPayload.service_name = updatedOriginalName;
      }
      
      const updateResponse = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(updateOriginalPayload),
        }
      );
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update original service');
      }
      
      // Extract ticket numbers from flight segments
      const ticketNumbers: Array<{ clientId: string; clientName: string; ticketNr: string }> = [];
      sortedNewSegments.forEach(seg => {
        if (seg.ticketNumber) {
          // Try to find matching ticket number in original service's ticketNumbers
          const originalTicket = service.ticketNumbers?.find(t => t.ticketNr === seg.ticketNumber);
          
          if (originalTicket) {
            // Use the same client info from original ticket
            ticketNumbers.push({
              clientId: originalTicket.clientId,
              clientName: originalTicket.clientName,
              ticketNr: seg.ticketNumber,
            });
          } else {
            // New ticket number - use first traveller or client from service
            const clientId = service.assignedTravellerIds?.[0] || '';
            const clientName = service.client || '';
            
            if (clientName) {
              ticketNumbers.push({
                clientId,
                clientName,
                ticketNr: seg.ticketNumber,
              });
            }
          }
        }
      });
      
      // 2. Create new change service with ONLY new segments
      // Normalize client/payer: if they are "-" or empty, set to null
      const normalizedClient = service.client && service.client !== "-" ? service.client : null;
      const normalizedPayer = service.payer && service.payer !== "-" ? service.payer : null;
      
      const changeServicePayload = {
        serviceName: changeServiceName,
        category: 'Flight',
        dateFrom: newServiceDateFrom,
        dateTo: newServiceDateTo,
        supplierPartyId: service.supplierPartyId || null,
        supplierName: service.supplier && service.supplier !== "-" ? service.supplier : null,
        clientPartyId: service.clientPartyId || null,
        clientName: normalizedClient,
        payerPartyId: service.payerPartyId || null,
        payerName: normalizedPayer,
        servicePrice: parseFloat(changeFee) || 0,
        clientPrice: parseFloat(clientPrice) || 0,
        resStatus: 'confirmed',
        refNr: service.refNr,
        flightSegments: sortedNewSegments,
        ticketNumbers: ticketNumbers.length > 0 ? ticketNumbers : undefined,
        cabinClass: newCabinClass,
        baggage: newBaggage,
        changeFee: parseFloat(changeFee) || 0,
        // Amendment fields
        parentServiceId: service.id,
        serviceType: 'change',
      };
      
      const createResponse = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(changeServicePayload),
        }
      );
      
      if (!createResponse.ok) {
        const errData = await createResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create change service');
      }
      
      onChangeConfirmed();
      onClose();
    } catch (err) {
      console.error('Change service error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process change');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatDate = (dateStr: string) => formatDateDDMMYYYY(dateStr || null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Change Flight</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close modal"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Original Service Info */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Segments to Change</h3>
            <div className="text-sm font-medium text-gray-900 mb-2">{service.name}</div>
            <div className="text-xs text-gray-500 mb-3">
              {formatDate(service.dateFrom || '')} - {formatDate(service.dateTo || '')}
            </div>
            {service.flightSegments && service.flightSegments.length > 0 && (
              <div className="mt-2 space-y-2">
                {service.flightSegments.map((seg, idx) => {
                  // Ensure segment has an id
                  const segmentId = seg.id || `seg-${idx}-${seg.flightNumber}-${seg.departure}-${seg.arrival}`;
                  const isSelected = selectedSegmentIds.has(segmentId);
                  return (
                    <label
                      key={segmentId}
                      className={`flex items-start gap-3 p-2 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSegmentSelection(segmentId)}
                        className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-medium text-gray-900">
                          {seg.flightNumber} {seg.airline ? `(${seg.airline})` : ''}
                        </div>
                        <div className="text-gray-600 mt-0.5">
                          {seg.departure} {seg.departureTimeScheduled} → {seg.arrival} {seg.arrivalTimeScheduled}
                        </div>
                        {seg.departureDate && (
                          <div className="text-gray-500 text-[10px] mt-0.5">
                            {formatDate(seg.departureDate)}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedSegmentIds.size > 0 && (
              <div className="mt-3 text-xs text-amber-700 font-medium">
                {selectedSegmentIds.size} segment{selectedSegmentIds.size > 1 ? 's' : ''} selected for change
              </div>
            )}
          </div>
          
          {/* Paste & Parse New Flight */}
          {selectedSegmentIds.size > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Paste & Parse New Flight Data
                <span className="text-xs text-gray-500 ml-2">
                  (will replace {selectedSegmentIds.size} selected segment{selectedSegmentIds.size > 1 ? 's' : ''})
                </span>
              </div>
              <div 
                className="border-2 border-dashed border-amber-300 rounded-lg p-3 bg-amber-50"
                onDrop={handleFileDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <textarea
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder="Paste booking confirmation text here or drop TXT file..."
                  className="w-full h-32 p-3 text-sm border-2 border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-y"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex-1">
                    {parseError && <span className="text-xs text-red-600">{parseError}</span>}
                    {parseSuccess && <span className="text-xs text-green-600">✓ Parsed successfully!</span>}
                  </div>
                  <button
                    onClick={handleParse}
                    disabled={!pasteInput.trim() || isParsing}
                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
                  >
                    {isParsing ? 'Parsing...' : 'Parse'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {selectedSegmentIds.size === 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                Please select the segments you want to change above, then paste and parse new flight data.
              </p>
            </div>
          )}
          
          {/* New Flight Preview */}
          {newSegments.length > 0 && selectedSegmentIds.size > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                New Segments (will replace selected)
              </h3>
              <div className="text-sm font-medium text-gray-900">{newServiceName}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatDate(newDateFrom)} - {formatDate(newDateTo)}
              </div>
              <div className="mt-2 space-y-1">
                {newSegments.map((seg, idx) => (
                  <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="font-medium">{seg.flightNumber}</span>
                    <span>{seg.departure} {seg.departureTimeScheduled}</span>
                    <span>-</span>
                    <span>{seg.arrival} {seg.arrivalTimeScheduled}</span>
                    {seg.cabinClass && (
                      <span className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded text-xs capitalize">
                        {seg.cabinClass.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Fees Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Change Fee (Cost)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={changeFee}
                    onChange={(e) => {
                      lastEditedRef.current = 'fee';
                      setChangeFee(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Fee charged by airline</p>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Marge</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={marge}
                    onChange={(e) => {
                      lastEditedRef.current = 'marge';
                      setMarge(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Margin</p>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client Price (Sale)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={clientPrice}
                    onChange={(e) => {
                      lastEditedRef.current = 'clientPrice';
                      setClientPrice(e.target.value);
                    }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Amount to charge client</p>
              </div>
            </div>
            
            {/* Profit display */}
            {(parseFloat(marge) || 0) !== 0 && (
              <div className="text-xs font-medium">
                <div className={parseFloat(marge) >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                  Profit: €{(parseFloat(marge) || 0).toFixed(2)}
                </div>
              </div>
            )}
          </div>
          
          {/* Cabin Class */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="change-cabin-class" className="block text-xs font-medium text-gray-600 mb-1">Cabin Class</label>
              <select
                id="change-cabin-class"
                value={newCabinClass}
                onChange={(e) => setNewCabinClass(e.target.value as typeof newCabinClass)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                aria-label="Cabin class"
              >
                <option value="economy">Economy</option>
                <option value="premium_economy">Premium Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Baggage</label>
              <input
                type="text"
                value={newBaggage}
                onChange={(e) => setNewBaggage(e.target.value)}
                placeholder="e.g., 1PC 23KG"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-4 py-3 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedSegmentIds.size === 0 || (selectedSegmentIds.size > 0 && newSegments.length === 0)}
            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">...</span>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Change
              </>
            )}
          </button>
        </div>
      </div>
      
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".txt" 
        className="hidden" 
        aria-label="Upload flight data file"
      />
    </div>
  );
}
