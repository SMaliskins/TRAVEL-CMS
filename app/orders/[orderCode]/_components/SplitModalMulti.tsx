'use client';

import React, { useState, useMemo } from 'react';
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
interface Service {

  id: string;
  name: string;
  category: string;
  servicePrice: number;
  clientPrice: number;
  payer: string;
  payerPartyId?: string;
  client: string;
  clientName?: string;
  payerName?: string;
  supplierName?: string;
  serviceName?: string;
  clientPartyId?: string;
}
interface SplitModalMultiProps {
  services: Service[];
  orderCode: string;
  onClose: () => void;
  onServicesUpdated: (updated: any[]) => void;
}

interface SplitConfig {
  numParts: number;
  parts: Array<{
    clientPrice: number;
    payer: string | null;
    travellers: string[];
  }>;
}

export default function SplitModalMulti({ services, orderCode, onClose, onServicesUpdated }: SplitModalMultiProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [splitConfigs, setSplitConfigs] = useState<Record<string, SplitConfig>>({});
  const [saving, setSaving] = useState(false);

  // ESC key handler
  useEscapeKey(onClose);
  
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Flight': '🛫',
      'Hotel': '🏨',
      'Transfer': '🚗',
      'Tour': '🗺️',
      'Insurance': '🛡️',
      'Visa': '📄',
      'Rent a Car': '🚙',
      'Cruise': '🚢',
      'Other': '📦'
    };
    return icons[category] || '📦';
  };

  const initializeSplitConfig = (service: Service): SplitConfig => {
    if (splitConfigs[service.id]) return splitConfigs[service.id];
    
    return {
      numParts: 2,
      parts: [
        {
          clientPrice: service.clientPrice / 2,
          payer: service.payer,
          travellers: []
        },
        {
          clientPrice: service.clientPrice / 2,
          payer: service.payer,
          travellers: []
        }
      ]
    };
  };

  const updateSplitConfig = (serviceId: string, config: SplitConfig) => {
    setSplitConfigs(prev => ({
      ...prev,
      [serviceId]: config
    }));
  };

  const adjustNumParts = (serviceId: string, numParts: number, service: Service) => {
    const currentConfig = splitConfigs[serviceId] || initializeSplitConfig(service);
    const pricePerPart = service.clientPrice / numParts;
    
    const newParts = Array(numParts).fill(null).map((_, idx) => ({
      clientPrice: pricePerPart,
      payer: currentConfig.parts[idx]?.payer || service.payer,
      travellers: currentConfig.parts[idx]?.travellers || []
    }));

    updateSplitConfig(serviceId, {
      numParts,
      parts: newParts
    });
  };

  const handleApplyAll = async () => {
    setSaving(true);
    try {
      const allSplits = [];
      
      for (const service of services) {
        const config = splitConfigs[service.id];
        if (!config || config.numParts < 2) continue;

        // API call для split
        const response = await fetch(`/api/orders/${orderCode}/services/${service.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'split',
            parts: config.parts.map((part, idx) => ({
              name: `${service.name}`,
              clientPrice: part.clientPrice,
              payer: part.payer,
              travellers: part.travellers,
              splitIndex: idx + 1,
              totalParts: config.numParts
            }))
          })
        });

        if (response.ok) {
          allSplits.push(await response.json());
        }
      }

      onServicesUpdated(allSplits);
    } catch (error) {
      console.error('Split error:', error);
      alert('Error applying split. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalConfiguredSplits = useMemo(() => {
    return Object.values(splitConfigs).reduce((sum, config) => {
      return sum + (config.numParts >= 2 ? config.numParts : 0);
    }, 0);
  }, [splitConfigs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold">
            ✂️ Split Selected Services ({services.length})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Overview
          </button>
          {services.map((service, idx) => (
            <button
              key={service.id}
              onClick={() => setActiveTab(`service-${idx}`)}
              className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === `service-${idx}`
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {idx + 1}️⃣ {service.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Click on a service to configure split:
              </p>
              {services.map((service, idx) => {
                const config = splitConfigs[service.id];
                const isConfigured = config && config.numParts >= 2;
                
                return (
                  <div
                    key={service.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors group cursor-pointer"
                    onClick={() => setActiveTab(`service-${idx}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getCategoryIcon(service.category)}</span>
                        <div>
                          <div className="font-medium">
                            {idx + 1}. {service.name}
                          </div>
                          <div className="text-xs text-gray-600">
                            Client: {service.clientName || '-'} | Payer: {service.payerName || '-'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            Total: €{service.clientPrice}
                          </div>
                          {isConfigured ? (
                            <div className="text-xs text-green-600">
                              ✅ Split into {config.numParts} parts
                            </div>
                          ) : (
                            <div className="text-xs text-amber-600">
                              ⚠️ Not configured
                            </div>
                          )}
                        </div>
                        
                        <span className="text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100">
                          Edit →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {services.map((service, idx) => {
            const config = splitConfigs[service.id] || initializeSplitConfig(service);
            
            return activeTab === `service-${idx}` && (
              <div key={service.id} className="space-y-4">
                {/* Service Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <h3 className="font-semibold text-blue-900">
                    {getCategoryIcon(service.category)} {service.name}
                  </h3>
                  <p className="text-sm text-blue-700">
                    Original: €{service.clientPrice} | Client: {service.clientName || '-'} | Payer: {service.payerName || '-'}
                  </p>
                </div>

                {/* Split Configuration */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Split into how many parts?
                  </label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        onClick={() => adjustNumParts(service.id, num, service)}
                        className={`px-4 py-2 rounded font-medium transition-colors ${
                          config.numParts === num
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parts Configuration */}
                <div className="space-y-3">
                  {config.parts.map((part, partIdx) => (
                    <div key={partIdx} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          Part {partIdx + 1} of {config.numParts}
                        </h4>
                        <div className="text-lg font-semibold text-blue-600">
                          €{part.clientPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {/* Price */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Client Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={part.clientPrice}
                            onChange={(e) => {
                              const newParts = [...config.parts];
                              newParts[partIdx].clientPrice = parseFloat(e.target.value) || 0;
                              updateSplitConfig(service.id, { ...config, parts: newParts });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Payer */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Payer (Optional)
                          </label>
                          <input
                            type="text"
                            value={part.payer || ''}
                            onChange={(e) => {
                              const newParts = [...config.parts];
                              newParts[partIdx].payer = e.target.value || null;
                              updateSplitConfig(service.id, { ...config, parts: newParts });
                            }}
                            placeholder="Same as original"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setActiveTab(idx > 0 ? `service-${idx-1}` : 'overview')}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setActiveTab(idx < services.length - 1 ? `service-${idx+1}` : 'overview')}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Next →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {totalConfiguredSplits > 0 ? (
              <span>✅ {totalConfiguredSplits} parts configured</span>
            ) : (
              <span>⚠️ No splits configured yet</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyAll}
              disabled={saving || totalConfiguredSplits === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Applying...' : `Apply Split (${totalConfiguredSplits})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
