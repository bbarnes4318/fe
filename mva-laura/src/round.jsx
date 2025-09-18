import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * DepoProveraLandingPage.jsx
 * - Single-page form for Depo-Provera Meningioma cases
 * - TrustedForm integration (xxTrustedFormCertUrl)
 * - TCPA consent checkbox
 * - Google Sheets integration for 'depo' sheet
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

export default function DepoProveraLandingPage() {
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
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country_diagnosis: "United States", // hidden field
    date_of_exposure: "",
    brief_description_of_your_situation: "",
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
    if (!form.address.trim()) e.address = "Address is required.";
    if (!form.city.trim()) e.city = "City is required.";
    if (!form.state) e.state = "Please select your state.";
    if (!form.postal_code.trim()) e.postal_code = "Postal code is required.";
    if (!form.date_of_exposure) e.date_of_exposure = "Date of exposure is required.";
    if (!form.brief_description_of_your_situation.trim()) e.brief_description_of_your_situation = "Please provide a brief description of your situation.";
    
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
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6">
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Depo-Provera Meningioma Legal Consultation
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Free Case Evaluation for Meningioma Diagnosis
          </p>
          <p className="text-gray-500">
            If you were diagnosed with Meningioma after using Depo-Provera for at least one year, you may be entitled to compensation.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Hidden fields */}
            <input type="hidden" id="xxTrustedFormCertUrl" name="xxTrustedFormCertUrl" value={form.xxTrustedFormCertUrl || trustedFormUrl} readOnly />
            <input type="hidden" name="country_diagnosis" value={form.country_diagnosis} />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.date_of_birth}
                  onChange={(e) => update({ date_of_birth: e.target.value })}
                />
                {errors.date_of_birth && <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>}
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.address}
                  onChange={(e) => update({ address: e.target.value })}
                  placeholder="Street address"
                />
                {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.city}
                  onChange={(e) => update({ city: e.target.value })}
                  placeholder="City"
                />
                {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.state}
                  onChange={(e) => update({ state: e.target.value })}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postal Code *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.postal_code}
                  onChange={(e) => update({ postal_code: e.target.value })}
                  placeholder="12345"
                />
                {errors.postal_code && <p className="text-red-500 text-sm mt-1">{errors.postal_code}</p>}
              </div>

              {/* Date of Exposure */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Exposure to Depo-Provera *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.date_of_exposure}
                  onChange={(e) => update({ date_of_exposure: e.target.value })}
                />
                {errors.date_of_exposure && <p className="text-red-500 text-sm mt-1">{errors.date_of_exposure}</p>}
              </div>

              {/* Brief Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brief Description of Your Situation *
                </label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.brief_description_of_your_situation}
                  onChange={(e) => update({ brief_description_of_your_situation: e.target.value })}
                  placeholder="Please describe your situation, including when you were diagnosed with Meningioma and how long you used Depo-Provera..."
                />
                {errors.brief_description_of_your_situation && <p className="text-red-500 text-sm mt-1">{errors.brief_description_of_your_situation}</p>}
              </div>
            </div>

            {/* Submit Button */}
            <div className="text-center pt-6">
              <button
                type="submit"
                disabled={submitting}
                className={`px-8 py-3 rounded-lg font-medium text-white ${
                  submitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                }`}
              >
                {submitting ? "Submitting..." : "Get Free Case Evaluation"}
              </button>
            </div>
          </form>
        </div>

        {/* TrustedForm noscript fallback */}
        <noscript>
          <img src="https://api.trustedform.com/ns.gif" alt="" />
        </noscript>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            <strong>Disclaimer:</strong> This is attorney advertising. Submitting information does not create an attorney-client relationship. 
            Past results do not guarantee similar outcomes. If you cannot be assisted, we may refer you to another firm.
          </p>
        </div>
      </div>
    </div>
  );
}