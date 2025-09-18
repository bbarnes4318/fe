import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * FinalExpenseLandingPage.jsx
 * - Single-page form for Final Expense Insurance prospects
 * - TrustedForm integration (xxTrustedFormCertUrl)
 * - TCPA consent (hidden field, defaulted to "Yes")
 * - Google Sheets integration for 'fe' sheet
 */

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

export default function FinalExpenseLandingPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [trustedFormUrl, setTrustedFormUrl] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    gender: "",
    date_of_birth: "",
    state: "",
    tcpa_consent_given: "Yes", // hidden field
    xxTrustedFormCertUrl: "",
    timestamp: "", // will be auto-generated
  });

  // TrustedForm script injection and callback
  useEffect(() => {
    // inject TrustedForm script exactly as provider recommends (field name = xxTrustedFormCertUrl)
    try {
      const field = "xxTrustedFormCertUrl";
      const provideReferrer = false;
      const invertFieldSensitivity = false;
      const tf = document.createElement("script");
      tf.type = "text/javascript";
      tf.async = true;
      tf.src =
        "https://api.trustedform.com/trustedform.js?provide_referrer=" +
        encodeURIComponent(provideReferrer) +
        "&field=" +
        encodeURIComponent(field) +
        "&l=" +
        new Date().getTime() +
        Math.random() +
        "&invert_field_sensitivity=" +
        encodeURIComponent(invertFieldSensitivity);
      const s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(tf, s);

      // global callback invoked by TrustedForm lib
      window.trustedFormCertUrlCallback = function (certificateUrl) {
        setTrustedFormUrl(certificateUrl);
        setForm((f) => ({ ...f, xxTrustedFormCertUrl: certificateUrl }));
      };
    } catch (e) {
      console.warn("TrustedForm script injection failed", e);
    }
    // empty deps -> run once
  }, []);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Form validation
  const validateForm = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required.";
    if (!form.phone.trim()) e.phone = "Phone number is required.";
    if (!/^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(form.phone || "")) e.phone = "Enter a valid US phone number.";
    if (!form.email.trim()) e.email = "Email address is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email || "")) e.email = "Enter a valid email address.";
    if (!form.gender) e.gender = "Please select your gender.";
    if (!form.date_of_birth) e.date_of_birth = "Date of birth is required.";
    if (!form.state) e.state = "Please select your state.";
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Final submit
  const onSubmit = async (ev) => {
    ev?.preventDefault?.();
    
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Add timestamp
      const formData = {
        ...form,
        timestamp: new Date().toISOString(),
        xxTrustedFormCertUrl: trustedFormUrl || form.xxTrustedFormCertUrl || "",
      };

      const response = await fetch("/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Webhook response:", result);

      setSubmitted(true);
      setErrors({});
    } catch (err) {
      console.error(err);
      alert("Submission failed. Please try again or contact us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-4">We have received your information and will contact you within 24 hours.</p>
            <p className="text-sm text-gray-500">If you have any urgent questions, please call us directly.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-indigo-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-blue-600/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Final Expense
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
                Insurance Protection
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-green-100 mb-8 max-w-3xl mx-auto">
              Secure Your Family's Future with Affordable Final Expense Coverage
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto border border-white/20">
              <p className="text-lg text-white mb-4">
                <span className="font-semibold text-yellow-300">Protect Your Loved Ones</span>
              </p>
              <p className="text-green-100">
                Get a free quote for final expense insurance that covers funeral costs, 
                medical bills, and other end-of-life expenses. No medical exam required.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Benefits Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Medical Exam</h3>
            <p className="text-green-100 text-sm">Simple health questions only. Get approved quickly and easily.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Affordable Premiums</h3>
            <p className="text-green-100 text-sm">Low monthly payments starting as low as $15/month.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Peace of Mind</h3>
            <p className="text-green-100 text-sm">Protect your family from unexpected financial burden.</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 border border-white/20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Get Your Free Quote Today</h2>
            <p className="text-gray-600 text-lg">Complete the form below and receive your personalized quote within minutes</p>
          </div>
          
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Hidden fields */}
            <input type="hidden" id="xxTrustedFormCertUrl" name="xxTrustedFormCertUrl" value={form.xxTrustedFormCertUrl || trustedFormUrl} readOnly />
            <input type="hidden" name="tcpa_consent_given" value={form.tcpa_consent_given} />
            <input type="hidden" name="timestamp" value={form.timestamp} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  value={form.full_name}
                  onChange={(e) => update({ full_name: e.target.value })}
                  placeholder="Enter your full name"
                />
                {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  value={form.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  value={form.email}
                  onChange={(e) => update({ email: e.target.value })}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender *
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  value={form.gender}
                  onChange={(e) => update({ gender: e.target.value })}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  value={form.date_of_birth}
                  onChange={(e) => update({ date_of_birth: e.target.value })}
                />
                {errors.date_of_birth && <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>}
              </div>

              {/* State */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State *
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  value={form.state}
                  onChange={(e) => update({ state: e.target.value })}
                >
                  <option value="">Select your state</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
              </div>
            </div>

            {/* Submit Button */}
            <div className="text-center pt-8">
              <button
                type="submit"
                disabled={submitting}
                className={`px-12 py-4 rounded-2xl font-bold text-lg text-white shadow-lg transform transition-all duration-200 ${
                  submitting
                    ? "bg-gray-400 cursor-not-allowed scale-95"
                    : "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 shadow-green-500/25"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Getting Your Quote...
                  </span>
                ) : (
                  "Get My Free Quote"
                )}
              </button>
              <p className="text-sm text-gray-500 mt-4">
                * No obligation • Free quote • Instant results
              </p>
            </div>
          </form>
        </div>

        {/* TrustedForm noscript fallback */}
        <noscript>
          <img src="https://api.trustedform.com/ns.gif" alt="" />
        </noscript>

        {/* Footer */}
        <div className="text-center mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
          <p className="text-sm text-green-100 leading-relaxed">
            <strong className="text-white">Disclaimer:</strong> This is an insurance quote request form. 
            Submitting information does not guarantee approval or coverage. Final rates and coverage 
            terms are subject to underwriting approval and may vary by state.
          </p>
        </div>
      </div>
    </div>
  );
}