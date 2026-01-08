"use client";

import React, { useState, useRef } from "react";

interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  profit: number;
  orders: number;
}

interface ProfitOrdersChartProps {
  data: ChartDataPoint[];
  className?: string;
}

export default function ProfitOrdersChart({
  data,
  className = "",
}: ProfitOrdersChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length === 0) {
    return (
      <div className={`rounded-lg bg-gray-50 p-6 shadow-sm ${className}`}>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Profit & Orders
        </h3>
        <div className="flex h-64 items-center justify-center text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  const chartHeight = 280;
  const chartPadding = { top: 20, right: 40, bottom: 50, left: 60 };
  const chartWidth = Math.max(800, data.length * 24);

  // Calculate max values for scaling
  const maxProfit = Math.max(...data.map((d) => d.profit), 1);
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  const maxValue = Math.max(maxProfit, maxOrders * 1000);

  // Default scale labels: 50K, 100K, 200K, 500K
  const defaultScaleLabels = [50, 100, 200, 500].map((val) => val * 1000);

  // Add more scale labels if needed
  let scaleLabels = [...defaultScaleLabels];
  if (maxValue > 500000) {
    if (maxValue > 1000000) {
      scaleLabels.push(1000 * 1000); // 1M
    }
    if (maxValue > 2000000) {
      scaleLabels.push(2000 * 1000); // 2M
    }
    if (maxValue > 5000000) {
      scaleLabels.push(5000 * 1000); // 5M
    }
  }

  // Filter scale labels to only show those <= maxValue
  scaleLabels = scaleLabels.filter((label) => label <= maxValue * 1.2); // Add 20% padding

  // Linear scale helper (starts from 0 at bottom)
  const linearScale = (value: number, max: number, height: number): number => {
    if (max === 0) return chartHeight - chartPadding.bottom;
    const ratio = value / max;
    return (
      chartHeight -
      chartPadding.bottom -
      ratio * (chartHeight - chartPadding.top - chartPadding.bottom)
    );
  };

  // Calculate x position for each data point
  const getX = (index: number): number => {
    const availableWidth = chartWidth - chartPadding.left - chartPadding.right;
    return chartPadding.left + (index / (data.length - 1 || 1)) * availableWidth;
  };

  // Format date for display (dd)
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + "T00:00:00");
    return String(date.getDate()).padStart(2, "0");
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Smooth curve path using cubic bezier curves for smooth transitions
  const createSmoothPath = (values: number[], startIndex = 0): string => {
    if (values.length === 0) return "";
    if (values.length === 1) return `M ${getX(startIndex)} ${values[0]}`;
    if (values.length === 2) {
      return `M ${getX(startIndex)} ${values[0]} L ${getX(startIndex + 1)} ${values[1]}`;
    }

    let path = `M ${getX(startIndex)} ${values[0]}`;

    for (let i = 1; i < values.length; i++) {
      const x0 = getX(startIndex + i - 1);
      const y0 = values[i - 1];
      const x1 = getX(startIndex + i);
      const y1 = values[i];

      if (i === 1) {
        // First segment: simple quadratic curve
        const cpX = (x0 + x1) / 2;
        const cpY = (y0 + y1) / 2;
        path += ` Q ${cpX} ${cpY}, ${x1} ${y1}`;
      } else {
        // Subsequent segments: use cubic bezier for smooth transition
        const xPrev = getX(startIndex + i - 2);
        const yPrev = values[i - 2];
        
        // Control points for smooth curve
        const cp1X = x0 + (x0 - xPrev) * 0.3;
        const cp1Y = y0 + (y0 - yPrev) * 0.3;
        const cp2X = x0 + (x1 - x0) * 0.3;
        const cp2Y = y0 + (y1 - y0) * 0.3;
        
        path += ` C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${x1} ${y1}`;
      }
    }

    return path;
  };

  // Get current date index
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDateIndex = data.findIndex((d) => {
    const date = new Date(d.date + "T00:00:00");
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  });

  // Generate smooth paths
  const profitValues = data.map((d) => linearScale(d.profit, maxValue, chartHeight));
  const ordersValues = data.map((d) => linearScale(d.orders * 1000, maxValue, chartHeight));

  // Split data into actual and forecast based on currentDateIndex
  const hasCurrentDate = currentDateIndex >= 0;
  const splitIndex = hasCurrentDate ? currentDateIndex + 1 : data.length;

  // Actual data (up to today)
  const actualProfitValues = profitValues.slice(0, splitIndex);
  const actualOrdersValues = ordersValues.slice(0, splitIndex);

  // Forecast data (from today to end) - includes today for smooth connection
  const forecastProfitValues = hasCurrentDate ? profitValues.slice(currentDateIndex) : [];
  const forecastOrdersValues = hasCurrentDate ? ordersValues.slice(currentDateIndex) : [];

  // Create smooth paths for actual data
  const profitPath = createSmoothPath(actualProfitValues, 0);
  const ordersPath = createSmoothPath(actualOrdersValues, 0);

  // Create smooth paths for forecast data (if exists)
  const forecastProfitPath = forecastProfitValues.length > 0 ? createSmoothPath(forecastProfitValues, currentDateIndex) : "";
  const forecastOrdersPath = forecastOrdersValues.length > 0 ? createSmoothPath(forecastOrdersValues, currentDateIndex) : "";

  // Create filled area paths (closed paths from line to bottom)
  const profitAreaPath =
    profitPath +
    ` L ${getX(splitIndex - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`;

  const ordersAreaPath =
    ordersPath +
    ` L ${getX(splitIndex - 1)} ${chartHeight - chartPadding.bottom} L ${getX(0)} ${chartHeight - chartPadding.bottom} Z`;

  // Forecast area paths (more transparent)
  const forecastProfitAreaPath = forecastProfitPath
    ? forecastProfitPath +
      ` L ${getX(data.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(currentDateIndex)} ${chartHeight - chartPadding.bottom} Z`
    : "";

  const forecastOrdersAreaPath = forecastOrdersPath
    ? forecastOrdersPath +
      ` L ${getX(data.length - 1)} ${chartHeight - chartPadding.bottom} L ${getX(currentDateIndex)} ${chartHeight - chartPadding.bottom} Z`
    : "";

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const availableWidth = chartWidth - chartPadding.left - chartPadding.right;
    const index = Math.round(
      ((x - chartPadding.left) / availableWidth) * (data.length - 1)
    );
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredX = hoveredIndex !== null ? getX(hoveredIndex) : null;
  const currentDateX = currentDateIndex >= 0 ? getX(currentDateIndex) : null;

  return (
    <div className={`rounded-lg bg-gray-50 p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Profit & Orders</h3>
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="overflow-visible"
        >
          <defs>
            {/* Gradient for Profit area */}
            <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
            {/* Gradient for Orders area */}
            <linearGradient id="ordersGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
            {/* Forecast gradients (more transparent) */}
            <linearGradient id="profitForecastGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="ordersForecastGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Y-axis labels */}
          {scaleLabels.map((label) => {
            const y = linearScale(label, maxValue, chartHeight);
            return (
              <text
                key={label}
                x={chartPadding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-600 text-xs"
                fontSize="11"
              >
                {formatCurrency(label)}
              </text>
            );
          })}

          {/* Filled areas under lines */}
          <path
            d={profitAreaPath}
            fill="url(#profitGradient)"
          />
          <path
            d={ordersAreaPath}
            fill="url(#ordersGradient)"
          />

          {/* Forecast filled areas (if exists) */}
          {forecastProfitAreaPath && (
            <path
              d={forecastProfitAreaPath}
              fill="url(#profitForecastGradient)"
            />
          )}
          {forecastOrdersAreaPath && (
            <path
              d={forecastOrdersAreaPath}
              fill="url(#ordersForecastGradient)"
            />
          )}

          {/* Current date vertical line */}
          {currentDateX !== null && (
            <line
              x1={currentDateX}
              y1={chartPadding.top}
              x2={currentDateX}
              y2={chartHeight - chartPadding.bottom}
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="4 2"
              opacity="0.7"
            />
          )}

          {/* Profit line (red) - smooth curve */}
          <path
            d={profitPath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Orders line (blue) - smooth curve */}
          <path
            d={ordersPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Forecast Profit line (red dashed) */}
          {forecastProfitPath && (
            <path
              d={forecastProfitPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 4"
              opacity="0.7"
            />
          )}

          {/* Forecast Orders line (blue dashed) */}
          {forecastOrdersPath && (
            <path
              d={forecastOrdersPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 4"
              opacity="0.7"
            />
          )}

          {/* X-axis labels (day numbers) */}
          {data.map((d, i) => {
            const x = getX(i);
            // Show every 5th day label to avoid crowding
            if (i % 5 === 0 || i === data.length - 1) {
              return (
                <text
                  key={i}
                  x={x}
                  y={chartHeight - chartPadding.bottom + 20}
                  textAnchor="middle"
                  className="fill-gray-600 text-xs"
                  fontSize="10"
                >
                  {formatDate(d.date)}
                </text>
              );
            }
            return null;
          })}

          {/* Vertical line on hover */}
          {hoveredX !== null && hoveredData && (
            <g>
              <line
                x1={hoveredX}
                y1={chartPadding.top}
                x2={hoveredX}
                y2={chartHeight - chartPadding.bottom}
                stroke="#6b7280"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
              {/* Tooltip for Profit */}
              <g transform={`translate(${hoveredX}, ${profitValues[hoveredIndex!]})`}>
                <circle cx="0" cy="0" r="5" fill="#ef4444" />
                <rect
                  x="-35"
                  y="-35"
                  width="70"
                  height={hoveredIndex! > currentDateIndex && currentDateIndex >= 0 ? "40" : "25"}
                  rx="4"
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  className="shadow-sm"
                />
                <text
                  x="0"
                  y="-18"
                  textAnchor="middle"
                  className="fill-gray-900 text-xs font-medium"
                  fontSize="11"
                >
                  {formatCurrency(hoveredData.profit)}
                </text>
                {hoveredIndex! > currentDateIndex && currentDateIndex >= 0 && (
                  <text
                    x="0"
                    y="-5"
                    textAnchor="middle"
                    className="fill-gray-500 text-xs"
                    fontSize="9"
                  >
                    (forecast)
                  </text>
                )}
              </g>
              {/* Tooltip for Orders */}
              <g transform={`translate(${hoveredX}, ${ordersValues[hoveredIndex!]})`}>
                <circle cx="0" cy="0" r="5" fill="#3b82f6" />
                <rect
                  x="-25"
                  y="10"
                  width="50"
                  height={hoveredIndex! > currentDateIndex && currentDateIndex >= 0 ? "35" : "20"}
                  rx="4"
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  className="shadow-sm"
                />
                <text
                  x="0"
                  y="25"
                  textAnchor="middle"
                  className="fill-gray-900 text-xs font-medium"
                  fontSize="11"
                >
                  {hoveredData.orders}
                </text>
                {hoveredIndex! > currentDateIndex && currentDateIndex >= 0 && (
                  <text
                    x="0"
                    y="38"
                    textAnchor="middle"
                    className="fill-gray-500 text-xs"
                    fontSize="9"
                  >
                    (forecast)
                  </text>
                )}
              </g>
            </g>
          )}
        </svg>
      </div>
      <div className="mt-4 flex items-center justify-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded-sm bg-red-500"></div>
          <span className="text-sm text-gray-600">Profit (actual)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded-sm bg-blue-500"></div>
          <span className="text-sm text-gray-600">Orders (actual)</span>
        </div>
        {hasCurrentDate && (
          <>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-8 bg-red-500 opacity-70" style={{ borderTop: "2px dashed #ef4444" }}></div>
              <span className="text-sm text-gray-600">Profit (forecast)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-8 bg-blue-500 opacity-70" style={{ borderTop: "2px dashed #3b82f6" }}></div>
              <span className="text-sm text-gray-600">Orders (forecast)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
