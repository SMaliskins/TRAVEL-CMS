"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [demoEmail, setDemoEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [demoCredentials, setDemoCredentials] = useState<{ email: string; password: string } | null>(null);

  const handleDemoSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEmail) return;

    setIsSubmitting(true);
    setSubmitMessage("");
    setDemoCredentials(null);

    try {
      const response = await fetch("/api/demo/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        const creds = data.credentials;
        if (creds) {
          setDemoCredentials(creds);
          setSubmitMessage(`Account created! Use these credentials to log in:`);
        } else {
          setSubmitMessage("Check your email for demo access credentials!");
        }
        setDemoEmail("");
      } else {
        setSubmitMessage(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setSubmitMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">TravelCMS</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
              <a href="#demo" className="text-gray-600 hover:text-gray-900 transition">Demo</a>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900 transition">
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Most Advanced Travel Agency Platform
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            The Ultimate
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> MID & Back Office </span>
            System
          </h1>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Automate your travel agency operations with AI-powered document parsing, 
            smart booking management, and comprehensive reporting. Built for modern agencies.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition text-lg"
            >
              Start Free Trial
            </Link>
            <a
              href="#demo"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-200 transition text-lg"
            >
              Watch Demo
            </a>
          </div>

          {/* Hero Image Placeholder */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-2xl aspect-video flex items-center justify-center">
              <p className="text-gray-500 text-lg">Dashboard Preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Agency
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed specifically for travel agencies
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon="ai"
              title="AI-Powered Parsing"
              description="Extract flight and tour details from PDFs, emails, and images in seconds using GPT-4o technology."
            />
            <FeatureCard
              icon="orders"
              title="Smart Booking Management"
              description="Manage orders, services, and clients with an intuitive interface. Track statuses and deadlines."
            />
            <FeatureCard
              icon="invoicing"
              title="Automated Invoicing"
              description="Generate professional invoices with one click. Multi-currency support and VAT handling."
            />
            <FeatureCard
              icon="notifications"
              title="Client Notifications"
              description="Automatic check-in reminders, booking confirmations, and document delivery via email and SMS."
            />
            <FeatureCard
              icon="reports"
              title="Advanced Reports"
              description="PTAC, IATA reports, financial analytics, and custom dashboards for data-driven decisions."
            />
            <FeatureCard
              icon="multi-tenant"
              title="Multi-User & Roles"
              description="Team collaboration with granular permissions. Subagents, agents, managers, and supervisors."
            />
          </div>
        </div>
      </section>

      {/* For Whom Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built for Travel Professionals
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AudienceCard
              icon="agency"
              title="Travel Agencies"
              description="From boutique to large agencies. Scale your operations."
            />
            <AudienceCard
              icon="operator"
              title="Tour Operators"
              description="Manage package tours, suppliers, and commissions."
            />
            <AudienceCard
              icon="corporate"
              title="Corporate Travel"
              description="Business travel management and reporting."
            />
            <AudienceCard
              icon="mice"
              title="MICE Agencies"
              description="Events, conferences, and group bookings."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start free, upgrade as you grow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <PricingCard
              name="Free"
              price="0"
              description="For getting started"
              features={["Up to 2 users", "Basic orders & services", "Standard reports", "Email support"]}
            />
            <PricingCard
              name="Starter"
              price="29"
              description="For small agencies"
              features={["Up to 5 users", "Client notifications", "Extended reports", "Priority support"]}
            />
            <PricingCard
              name="Pro"
              price="99"
              description="For growing agencies"
              features={["Up to 20 users", "AI document parsing", "PTAC & IATA reports", "AI assistant", "API access"]}
              featured
            />
            <PricingCard
              name="Enterprise"
              price="299"
              description="For large organizations"
              features={["Unlimited users", "All features", "Custom integrations", "Dedicated support", "SLA guarantee"]}
            />
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-4 bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Try It Free for 3 Days
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            No credit card required. Full access to all features.
          </p>

          <form onSubmit={handleDemoSignup} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
            <input
              type="email"
              value={demoEmail}
              onChange={(e) => setDemoEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 px-6 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-white/30"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-4 bg-white hover:bg-gray-100 text-blue-600 font-semibold rounded-xl transition disabled:opacity-50"
            >
              {isSubmitting ? "..." : "Get Demo Access"}
            </button>
          </form>

          {submitMessage && (
            <div className="mt-4 text-white">
              <p>{submitMessage}</p>
              {demoCredentials && (
                <div className="mt-3 p-4 bg-white/10 rounded-lg text-left max-w-md mx-auto">
                  <p className="text-sm opacity-90">Email: {demoCredentials.email}</p>
                  <p className="text-sm opacity-90">Password: {demoCredentials.password}</p>
                  <Link
                    href="/login"
                    className="inline-block mt-3 px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition"
                  >
                    Go to Login →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <span className="text-white font-semibold">TravelCMS</span>
            </div>

            <div className="flex items-center gap-8 text-sm">
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>

            <p className="text-sm">
              © {new Date().getFullYear()} TravelCMS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  const icons: Record<string, React.ReactNode> = {
    ai: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    orders: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    invoicing: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    notifications: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    reports: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    "multi-tenant": (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg hover:border-gray-200 transition">
      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
        {icons[icon]}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function AudienceCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  const icons: Record<string, string> = {
    agency: "🏢",
    operator: "🌍",
    corporate: "💼",
    mice: "🎪",
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 text-center">
      <div className="text-4xl mb-4">{icons[icon]}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  description,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-2xl ${
        featured
          ? "bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2"
          : "bg-white border border-gray-200"
      }`}
    >
      <h3 className={`text-lg font-semibold mb-1 ${featured ? "text-white" : "text-gray-900"}`}>
        {name}
      </h3>
      <p className={`text-sm mb-4 ${featured ? "text-blue-100" : "text-gray-500"}`}>
        {description}
      </p>
      <div className="mb-6">
        <span className={`text-4xl font-bold ${featured ? "text-white" : "text-gray-900"}`}>
          €{price}
        </span>
        <span className={featured ? "text-blue-100" : "text-gray-500"}>/month</span>
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <svg
              className={`w-5 h-5 ${featured ? "text-blue-200" : "text-green-500"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className={`text-sm ${featured ? "text-blue-50" : "text-gray-600"}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        className={`block w-full py-3 text-center font-medium rounded-lg transition ${
          featured
            ? "bg-white text-blue-600 hover:bg-blue-50"
            : "bg-gray-100 text-gray-900 hover:bg-gray-200"
        }`}
      >
        Get Started
      </Link>
    </div>
  );
}
