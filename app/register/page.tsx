"use client";

import { useState } from "react";
import Link from "next/link";

interface UserEntry {
  name: string;
  email: string;
  role: string;
}

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Step 1: Company info
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2: Plan selection
  const [selectedPlan, setSelectedPlan] = useState("free");

  // Step 3: Users
  const [users, setUsers] = useState<UserEntry[]>([
    { name: "", email: "", role: "supervisor" },
  ]);

  const plans = [
    { id: "free", name: "Free", price: 0, description: "Up to 2 users, basic features" },
    { id: "starter", name: "Starter", price: 29, description: "Up to 5 users, notifications" },
    { id: "pro", name: "Pro", price: 99, description: "Up to 20 users, AI features" },
    { id: "enterprise", name: "Enterprise", price: 299, description: "Unlimited, all features" },
  ];

  const roles = [
    { id: "supervisor", name: "Supervisor", description: "Full access" },
    { id: "manager", name: "Manager", description: "Manage team" },
    { id: "finance", name: "Finance", description: "Financial operations" },
    { id: "agent", name: "Agent", description: "Standard access" },
    { id: "subagent", name: "Subagent", description: "Limited access" },
  ];

  const addUser = () => {
    setUsers([...users, { name: "", email: "", role: "agent" }]);
  };

  const removeUser = (index: number) => {
    if (users.length > 1) {
      setUsers(users.filter((_, i) => i !== index));
    }
  };

  const updateUser = (index: number, field: keyof UserEntry, value: string) => {
    const newUsers = [...users];
    newUsers[index][field] = value;
    setUsers(newUsers);
  };

  const validateStep1 = () => {
    if (!companyName.trim()) {
      setError("Company name is required");
      return false;
    }
    if (!email.trim()) {
      setError("Contact email is required");
      return false;
    }
    setError("");
    return true;
  };

  const validateStep3 = () => {
    const hasSupervisor = users.some((u) => u.role === "supervisor" && u.email.trim());
    if (!hasSupervisor) {
      setError("At least one Supervisor is required");
      return false;
    }
    for (const user of users) {
      if (!user.email.trim() || !user.name.trim()) {
        setError("All users must have name and email");
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: {
            name: companyName,
            legal_name: legalName,
            country,
            email,
            phone,
          },
          plan: selectedPlan,
          users,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Your registration is being reviewed. You will receive an email with login credentials once approved.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">TravelCMS</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-600 mt-2">
            Set up your travel agency in minutes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  step >= s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {s}
              </div>
              <span className={`text-sm ${step >= s ? "text-gray-900" : "text-gray-500"}`}>
                {s === 1 ? "Company" : s === 2 ? "Plan" : "Users"}
              </span>
              {s < 3 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Company Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Travel Agency"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Legal Name
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Legal Entity Name Ltd"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select country</option>
                    <option value="LV">Latvia</option>
                    <option value="LT">Lithuania</option>
                    <option value="EE">Estonia</option>
                    <option value="DE">Germany</option>
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+371 12345678"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="contact@company.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => validateStep1() && setStep(2)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Plan Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                      selectedPlan === plan.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{plan.name}</span>
                      <span className="text-lg font-bold text-gray-900">
                        €{plan.price}<span className="text-sm font-normal text-gray-500">/mo</span>
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Users */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
                <button
                  onClick={addUser}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add User
                </button>
              </div>

              <p className="text-sm text-gray-500">
                At least one Supervisor is required. They will manage your account.
              </p>

              <div className="space-y-4">
                {users.map((user, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">User {index + 1}</span>
                      {users.length > 1 && (
                        <button
                          onClick={() => removeUser(index)}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={user.name}
                        onChange={(e) => updateUser(index, "name", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Full Name"
                      />
                      <input
                        type="email"
                        value={user.email}
                        onChange={(e) => updateUser(index, "email", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Email"
                      />
                      <select
                        value={user.role}
                        onChange={(e) => updateUser(index, "role", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition"
                >
                  {isSubmitting ? "Submitting..." : "Submit Registration"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
