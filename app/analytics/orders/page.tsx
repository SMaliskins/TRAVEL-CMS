"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Order {
  orderCode: string;
  client: string;
  dateCreated: string; // YYYY-MM-DD
  amount: number;
  paid: number;
  debt: number;
  profit: number;
  type: string;
  owner: string;
}

// Mock data
const mockOrders: Order[] = [
  {
    orderCode: "0001/25-SM",
    client: "John Smith",
    dateCreated: "2025-01-15",
    amount: 2500,
    paid: 2500,
    debt: 0,
    profit: 850,
    type: "TA",
    owner: "JS",
  },
  {
    orderCode: "0002/25-AB",
    client: "Alice Brown",
    dateCreated: "2025-01-14",
    amount: 3200,
    paid: 1500,
    debt: 1700,
    profit: 1100,
    type: "TO",
    owner: "MK",
  },
  {
    orderCode: "0003/25-CD",
    client: "Corporate Travel Inc.",
    dateCreated: "2025-01-13",
    amount: 4500,
    paid: 4500,
    debt: 0,
    profit: 1450,
    type: "CORP",
    owner: "JS",
  },
  {
    orderCode: "0004/25-EF",
    client: "Robert Johnson",
    dateCreated: "2025-01-12",
    amount: 1800,
    paid: 0,
    debt: 1800,
    profit: 600,
    type: "TA",
    owner: "AB",
  },
  {
    orderCode: "0005/25-GH",
    client: "Sarah Williams",
    dateCreated: "2025-02-10",
    amount: 2100,
    paid: 2100,
    debt: 0,
    profit: 720,
    type: "TO",
    owner: "MK",
  },
  {
    orderCode: "0006/25-IJ",
    client: "Michael Davis",
    dateCreated: "2025-02-08",
    amount: 2800,
    paid: 1400,
    debt: 1400,
    profit: 950,
    type: "TA",
    owner: "JS",
  },
  {
    orderCode: "0007/25-KL",
    client: "Non-Profit Organization",
    dateCreated: "2025-03-05",
    amount: 1500,
    paid: 1500,
    debt: 0,
    profit: 400,
    type: "NON",
    owner: "AB",
  },
  {
    orderCode: "0008/25-MN",
    client: "Emma Wilson",
    dateCreated: "2025-03-12",
    amount: 3500,
    paid: 2000,
    debt: 1500,
    profit: 1200,
    type: "TO",
    owner: "MK",
  },
  {
    orderCode: "0009/25-OP",
    client: "Tech Corp Solutions",
    dateCreated: "2025-03-15",
    amount: 5200,
    paid: 5200,
    debt: 0,
    profit: 1800,
    type: "CORP",
    owner: "JS",
  },
  {
    orderCode: "0010/25-QR",
    client: "David Martinez",
    dateCreated: "2024-12-20",
    amount: 1900,
    paid: 0,
    debt: 1900,
    profit: 650,
    type: "TA",
    owner: "AB",
  },
  {
    orderCode: "0011/25-ST",
    client: "Lisa Anderson",
    dateCreated: "2025-01-20",
    amount: 2200,
    paid: 2200,
    debt: 0,
    profit: 750,
    type: "TO",
    owner: "MK",
  },
  {
    orderCode: "0012/25-UV",
    client: "James Taylor",
    dateCreated: "2025-02-15",
    amount: 2700,
    paid: 1350,
    debt: 1350,
    profit: 920,
    type: "TA",
    owner: "JS",
  },
  {
    orderCode: "0013/25-WX",
    client: "Maria Garcia",
    dateCreated: "2025-03-20",
    amount: 3100,
    paid: 3100,
    debt: 0,
    profit: 1050,
    type: "CORP",
    owner: "JS",
  },
  {
    orderCode: "0014/25-YZ",
    client: "Tom Wilson",
    dateCreated: "2025-01-25",
    amount: 1650,
    paid: 1650,
    debt: 0,
    profit: 550,
    type: "TA",
    owner: "AB",
  },
  {
    orderCode: "0015/25-AA",
    client: "Sophie Martin",
    dateCreated: "2025-02-22",
    amount: 2900,
    paid: 1500,
    debt: 1400,
    profit: 980,
    type: "TO",
    owner: "MK",
  },
  {
    orderCode: "0016/25-BB",
    client: "Global Corp",
    dateCreated: "2025-03-18",
    amount: 4800,
    paid: 4800,
    debt: 0,
    profit: 1650,
    type: "CORP",
    owner: "JS",
  },
];

interface TreeNode {
  key: string;
  label: string;
  level: "year" | "month" | "day" | "order";
  children: TreeNode[];
  orders: Order[];
  totals: {
    amount: number;
    paid: number;
    debt: number;
    profit: number;
  };
}

const formatCurrency = (amount: number) => {
  return `€${amount.toLocaleString()}`;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function OrdersAnalyticsPage() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["2025"])
  );
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");

  const toggleNode = (key: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedNodes(newExpanded);
  };

  const treeData = useMemo(() => {
    // Group orders by year -> month -> day
    const yearMap = new Map<
      string,
      Map<string, Map<string, Order[]>>
    >();

    mockOrders.forEach((order) => {
      const date = new Date(order.dateCreated);
      const year = date.getFullYear().toString();
      const month = date.getMonth().toString();
      const day = date.getDate().toString();

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;

      if (!monthMap.has(month)) {
        monthMap.set(month, new Map());
      }
      const dayMap = monthMap.get(month)!;

      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(order);
    });

    // Build tree structure
    const root: TreeNode[] = [];

    yearMap.forEach((monthMap, year) => {
      const yearNode: TreeNode = {
        key: year,
        label: year,
        level: "year",
        children: [],
        orders: [],
        totals: { amount: 0, paid: 0, debt: 0, profit: 0 },
      };

      const sortedMonths = Array.from(monthMap.keys()).sort(
        (a, b) => parseInt(a) - parseInt(b)
      );

      sortedMonths.forEach((month) => {
        const dayMap = monthMap.get(month)!;
        const monthNode: TreeNode = {
          key: `${year}-${month}`,
          label: monthNames[parseInt(month)],
          level: "month",
          children: [],
          orders: [],
          totals: { amount: 0, paid: 0, debt: 0, profit: 0 },
        };

        const sortedDays = Array.from(dayMap.keys()).sort(
          (a, b) => parseInt(a) - parseInt(b)
        );

        sortedDays.forEach((day) => {
          const orders = dayMap.get(day)!;
          const dayTotals = orders.reduce(
            (acc, o) => ({
              amount: acc.amount + o.amount,
              paid: acc.paid + o.paid,
              debt: acc.debt + o.debt,
              profit: acc.profit + o.profit,
            }),
            { amount: 0, paid: 0, debt: 0, profit: 0 }
          );

          const dayNode: TreeNode = {
            key: `${year}-${month}-${day}`,
            label: day,
            level: "day",
            children: [],
            orders: orders,
            totals: dayTotals,
          };

          orders.forEach((order) => {
            dayNode.children.push({
              key: order.orderCode,
              label: order.orderCode,
              level: "order",
              children: [],
              orders: [order],
              totals: {
                amount: order.amount,
                paid: order.paid,
                debt: order.debt,
                profit: order.profit,
              },
            });
          });

          // Update month totals
          monthNode.totals.amount += dayTotals.amount;
          monthNode.totals.paid += dayTotals.paid;
          monthNode.totals.debt += dayTotals.debt;
          monthNode.totals.profit += dayTotals.profit;

          monthNode.children.push(dayNode);
        });

        // Update year totals
        yearNode.totals.amount += monthNode.totals.amount;
        yearNode.totals.paid += monthNode.totals.paid;
        yearNode.totals.debt += monthNode.totals.debt;
        yearNode.totals.profit += monthNode.totals.profit;

        yearNode.children.push(monthNode);
      });

      root.push(yearNode);
    });

    return root.sort((a, b) => b.key.localeCompare(a.key));
  }, []);

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.key);
    const hasChildren = node.children.length > 0;
    const indent = depth * 24;

    return (
      <div key={node.key}>
        <div
          className={`flex items-center border-b border-gray-200 transition-colors ${
            node.level === "order"
              ? "hover:bg-blue-50"
              : "bg-gray-50 hover:bg-gray-100"
          }`}
          style={{ paddingLeft: `${indent}px` }}
        >
          {/* Expand/Collapse Button */}
          <div className="w-8 py-3">
            {hasChildren && (
              <button
                onClick={() => toggleNode(node.key)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200"
              >
                {isExpanded ? (
                  <span className="text-gray-600">−</span>
                ) : (
                  <span className="text-gray-600">+</span>
                )}
              </button>
            )}
          </div>

          {/* Label */}
          <div className="flex-1 py-3">
            {node.level === "order" ? (
              <Link
                href={`/orders/${node.label}`}
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                {node.label}
              </Link>
            ) : (
              <span
                className={`font-medium ${
                  node.level === "year"
                    ? "text-lg text-gray-900"
                    : node.level === "month"
                    ? "text-base text-gray-800"
                    : "text-sm text-gray-700"
                }`}
              >
                {node.level === "day"
                  ? `${monthNames[parseInt(node.key.split("-")[1])]} ${node.label}`
                  : node.label}
              </span>
            )}
            {node.level === "order" && (
              <span className="ml-2 text-sm text-gray-500">
                {node.orders[0].client} • {node.orders[0].type} • {node.orders[0].owner}
              </span>
            )}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-4 gap-4 py-3 pr-4 text-right text-sm">
            <div className="w-24 font-medium">{formatCurrency(node.totals.amount)}</div>
            <div className="w-24">{formatCurrency(node.totals.paid)}</div>
            <div
              className={`w-24 ${
                node.totals.debt > 0 ? "font-medium text-orange-600" : ""
              }`}
            >
              {formatCurrency(node.totals.debt)}
            </div>
            <div className="w-24 font-semibold text-gray-900">
              {formatCurrency(node.totals.profit)}
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const uniqueYears = useMemo(() => {
    const years = new Set(mockOrders.map((o) => new Date(o.dateCreated).getFullYear().toString()));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, []);

  const uniqueOwners = useMemo(() => {
    const owners = new Set(mockOrders.map((o) => o.owner));
    return Array.from(owners).sort();
  }, []);

  return (
    <div className="bg-gray-50 p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Orders Analytics</h1>
        </div>

        {/* Filters */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="">All Years</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="">All Months</option>
                {monthNames.map((month, index) => (
                  <option key={index} value={index}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Owner
              </label>
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="">All Owners</option>
                {uniqueOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="TA">TA</option>
                <option value="TO">TO</option>
                <option value="CORP">CORP</option>
                <option value="NON">NON</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tree Table */}
        <div className="rounded-lg bg-white shadow-sm">
          {/* Header */}
          <div className="border-b-2 border-gray-300 bg-gray-100">
            <div className="flex items-center">
              <div className="w-8 py-3"></div>
              <div className="flex-1 py-3 pl-4 font-semibold text-gray-900">
                Period / Order
              </div>
              <div className="grid grid-cols-4 gap-4 py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">
                <div className="w-24">Amount</div>
                <div className="w-24">Paid</div>
                <div className="w-24">Debt</div>
                <div className="w-24">Profit</div>
              </div>
            </div>
          </div>

          {/* Tree */}
          <div className="divide-y divide-gray-200">
            {treeData.map((yearNode) => renderNode(yearNode))}
          </div>
        </div>
      </div>
    </div>
  );
}

