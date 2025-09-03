import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * RoundupLandingPage.jsx
 * - Full multi-step intake form (steps 1..6)
 * - Hard filters: state (CA/OR/WA/HI), age < 60, diag window: residential <=10y, occupational <=2y
 * - Disqualifiers list
 * - TrustedForm integration (xxTrustedFormCertUrl)
 * - TCPA opt-in checkbox (id="tcpa_opt_in", name="tcpa_opt_in")
 *
 * Notes:
 * - Replace mock submission in onSubmit with your intake endpoint & headers.
 * - Ensure Tailwind & framer-motion are present in your project.
 */

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 65 }, (_, i) => String(CURRENT_YEAR - i));
const STATES = ["CA", "OR", "WA", "HI"];

const NHL_SUBTYPES = [
  "Diffuse Large B-Cell Lymphoma (DLBCL)",
  "Mantle Cell Lymphoma (MCL)",
  "Lymphoblastic Lymphoma",
  "Burkitt Lymphoma (BL)",
  "Plasmablastic Lymphoma",
  "Primary Mediastinal (Thymic) Large B-Cell Lymphoma (PMBCL)",
  "Transformed Follicular or MALT Lymphomas",
  "High-Grade B-Cell Lymphoma (Double/Triple Hit)",
  "Primary Cutaneous DLBCL, Leg Type",
  "Primary CNS Lymphoma",
  "AIDS-Associated Lymphoma",
  "Follicular Lymphoma (FL)",
  "Marginal Zone Lymphoma (MZL)",
  "Chronic Lymphocytic Leukemia / Small Lymphocytic Lymphoma (CLL/SLL)",
  "MALT Lymphoma (Gastric or Other)",
  "Lymphoplasmacytic Lymphoma",
  "Waldenström Macroglobulinemia (WM)",
  "Nodal Marginal Zone Lymphoma (NMZL)",
  "Splenic Marginal Zone Lymphoma (SMZL)",
  "Peripheral T-Cell Lymphoma, NOS",
  "Systemic Anaplastic Large-Cell Lymphoma (ALCL)",
  "Hepatosplenic T-Cell Lymphoma",
  "Enteropathy-Associated Intestinal T-Cell Lymphoma",
  "Angioimmunoblastic T-Cell Lymphoma (AITL)",
  "Adult T-Cell Leukemia/Lymphoma",
  "Extranodal NK/T-Cell Lymphoma, Nasal Type",
  "Cutaneous T-Cell Lymphoma (CTCL)",
  "Mycosis Fungoides (MF)",
  "Sézary Syndrome (SS)",
  "Primary Cutaneous ALCL",
  "Subcutaneous Panniculitis-like T-Cell Lymphoma (SPTCL)",
  "Primary Cutaneous Gamma Delta T-Cell Lymphoma",
];

const DISQUALIFIERS = [
  { key: "hepatitis", label: "Diagnosed with Hepatitis A, B, or C" },
  { key: "ebv", label: "History of Epstein-Barr Virus (EBV)" },
  { key: "autoimmune", label: "History of autoimmune disease (e.g., Hashimoto's)" },
  { key: "other_pesticides", label: "Significant exposure to non-glyphosate pesticides (e.g., DDT)" },
  { key: "solvents", label: "Exposure to heavy industrial solvents (e.g., benzene)" },
  { key: "agent_orange", label: "Exposure to Agent Orange" },
  { key: "smoking", label: "History of smoking" },
  { key: "previous_cancer", label: "Any previous cancer diagnosis" },
  { key: "welding", label: "Professional welding work" },
  { key: "camp_lejeune", label: "Military service at Camp Lejeune" },
  { key: "firefighting", label: "Professional or volunteer firefighting" },
  { key: "hard_drugs", label: "Use of hard drugs (cocaine, heroin, methamphetamine)" },
];

export default function RoundupLandingPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [trustedFormUrl, setTrustedFormUrl] = useState("");

  const [form, setForm] = useState({
    exposureType: "",
    exposureYear: "",
    diagnosis: "",
    diagnosisYear: "",
    ageAtDiagnosis: "",
    state: "",
    represented: "",
    disqualifiers: {}, // map of key->bool
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    contactTime: "Anytime",
    notes: "",
    website_url: "", // honeypot
    tcpa_opt_in: false, // maps to the checkbox the user requested
    xxTrustedFormCertUrl: "",
  });

  // localStorage restore/save so user can come back
  useEffect(() => {
    try {
      const saved = localStorage.getItem("roundup-intake");
      if (saved) setForm(JSON.parse(saved));
    } catch (e) {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("roundup-intake", JSON.stringify(form));
    } catch (e) {
      /* ignore */
    }
  }, [form]);

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

  const progress = useMemo(() => {
    const map = { 1: 16, 2: 32, 3: 48, 4: 64, 5: 80, 6: 100 };
    return map[step] || 0;
  }, [step]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleDisqualifier = (key) =>
    setForm((f) => ({ ...f, disqualifiers: { ...f.disqualifiers, [key]: !f.disqualifiers[key] } }));

  // Derived eligibility checks
  const isOccupational = form.exposureType === "Occupational";
  const diagnosisYearNum = Number(form.diagnosisYear) || null;
  const yearsSinceDiagnosis = diagnosisYearNum ? CURRENT_YEAR - diagnosisYearNum : null;
  const failedDisqualifier = Object.values(form.disqualifiers || {}).some(Boolean);

  const passesAgeRule = form.ageAtDiagnosis !== "" && Number(form.ageAtDiagnosis) < 60;
  const passesDiagnosisWindow = (() => {
    if (!diagnosisYearNum) return true;
    if (isOccupational) return yearsSinceDiagnosis <= 2;
    return yearsSinceDiagnosis <= 10;
  })();
  const passesStateRule = STATES.includes(form.state);

  const isDisqualified = !passesAgeRule || !passesDiagnosisWindow || !passesStateRule || failedDisqualifier;

  // Step validation
  const validateStep = () => {
    const e = {};
    if (step === 1 && !form.exposureType) e.exposureType = "Please select exposure type.";
    if (step === 2 && !form.exposureYear) e.exposureYear = "Select earliest year of exposure.";
    if (step === 3) {
      if (!form.diagnosis) e.diagnosis = "Select your NHL subtype.";
      if (!form.diagnosisYear) e.diagnosisYear = "Select diagnosis year.";
      if (!form.ageAtDiagnosis) e.ageAtDiagnosis = "Enter age at diagnosis.";
      if (form.ageAtDiagnosis && Number(form.ageAtDiagnosis) >= 120) e.ageAtDiagnosis = "Enter a realistic age.";
      // immediate timeframe/age hints (not blocking here if fields missing)
      if (form.ageAtDiagnosis && Number(form.ageAtDiagnosis) >= 60) e.ageAtDiagnosis = "Must be under 60 at diagnosis.";
      if (form.diagnosisYear) {
        const yearsAgo = CURRENT_YEAR - Number(form.diagnosisYear);
        if (form.exposureType === "Occupational" && yearsAgo > 2) e.diagnosisYear = "For occupational cases, diagnosis must be within 2 years.";
        if (form.exposureType !== "Occupational" && yearsAgo > 10) e.diagnosisYear = "Diagnosis must be within 10 years.";
      }
    }
    if (step === 4 && !form.state) e.state = "Choose your state.";
    if (step === 5) {
      if (!form.firstName) e.firstName = "First name required.";
      if (!form.lastName) e.lastName = "Last name required.";
      if (!/^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(form.phone || "")) e.phone = "Enter a valid US phone number.";
      if (!/^\S+@\S+\.\S+$/.test(form.email || "")) e.email = "Enter a valid email address.";
      if (!form.tcpa_opt_in) e.tcpa_opt_in = "You must agree to be contacted by phone/SMS/email.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Final submit
  const onSubmit = async (ev) => {
    ev?.preventDefault?.();
    // final validate step 5/6 items
    if (!validateStep()) return;

    // enforce hard rules before submit
    if (isDisqualified) {
      setErrors((prev) => ({
        ...prev,
        hardFail:
          "Based on the criteria you provided, this lead does not meet eligibility requirements. If you believe this is an error, review your answers or contact us.",
      }));
      return;
    }

    // honeypot check
    if (form.website_url) {
      // likely bot — mark as submitted but don't forward
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      // Build payload (include TrustedForm cert + tcpa flag)
      const payload = {
        exposureType: form.exposureType,
        exposureYear: form.exposureYear,
        diagnosis: form.diagnosis,
        diagnosisYear: form.diagnosisYear,
        ageAtDiagnosis: form.ageAtDiagnosis,
        state: form.state,
        represented: form.represented,
        disqualifiers: form.disqualifiers,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        contactTime: form.contactTime,
        notes: form.notes,
        tcpa_opt_in: form.tcpa_opt_in ? 1 : 0,
        xxTrustedFormCertUrl: trustedFormUrl || form.xxTrustedFormCertUrl || "",
      };

      // Map form data to webhook format
      const webhookData = {
        first_name: form.firstName,
        last_name: form.lastName,
        caller_id: form.phone,
        email: form.email,
        address: '', // Could be added to form if needed
        city: '', // Could be added to form if needed
        state: form.state,
        zip: '', // Could be added to form if needed
        accident_date: form.exposureYear,
        ip_address: '', // Will be set by server
        source_url: window.location.href,
        trusted_form_cert_url: trustedFormUrl || form.xxTrustedFormCertUrl || '',
        tcpa_opt_in: form.tcpa_opt_in ? 'Yes' : 'No',
        // Additional fields from the form
        exposure_type: form.exposureType,
        exposure_year: form.exposureYear,
        exposure_frequency_per_year: form.exposureFrequencyPerYear,
        exposure_years_duration: form.exposureYearsDuration,
        diagnosis: form.diagnosis,
        diagnosis_year: form.diagnosisYear,
        age_at_diagnosis: form.ageAtDiagnosis,
        represented: form.represented,
        contact_time: form.contactTime,
        notes: form.notes
      };

      const response = await fetch("/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookData)
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
      alert("Submission failed. Please call 1-800-555-0199 or try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Roundup® (Glyphosate) — Free Eligibility Check</h1>
          <p className="text-sm text-white/80 mt-1">Answer a few questions — takes ~2 minutes. This is attorney advertising.</p>
        </header>

        <div className="mb-4">
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full bg-emerald-400" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm">Step {step} of 6</p>
        </div>

        {errors.hardFail && (
          <div className="mb-4 rounded-md bg-rose-700/30 border border-rose-600 p-3 text-sm">
            <strong>Not eligible:</strong> {errors.hardFail}
            <div className="mt-1 text-xs text-white/80">
              Hard disqualifiers include: age ≥ 60 at diagnosis, diagnosis outside allowed window (residential ≤10y, occupational ≤2y), residence outside CA/OR/WA/HI,
              or any matching disqualifying condition/exposure.
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Hidden TrustedForm input and honeypot */}
          <input type="hidden" id="xxTrustedFormCertUrl" name="xxTrustedFormCertUrl" value={form.xxTrustedFormCertUrl || trustedFormUrl} readOnly />
          <input type="text" name="website_url" value={form.website_url} onChange={(e) => update({ website_url: e.target.value })} style={{ display: "none" }} autoComplete="off" />

          <AnimatePresence mode="wait">
            {/* STEP 1 */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label className="block mb-2 font-medium">1) How were you exposed to Roundup® / glyphosate?</label>
                <select className="w-full p-2 rounded text-black" value={form.exposureType} onChange={(e) => update({ exposureType: e.target.value })}>
                  <option value="">Select exposure type</option>
                  <option value="Personal use">Personal / Residential use</option>
                  <option value="Occupational">Occupational / IT&O (landscaping, groundskeeping, cemetery, greenskeeping)</option>
                  <option value="Second-hand">Second-hand / Nearby spraying</option>
                </select>
                {errors.exposureType && <p className="text-rose-300 text-xs mt-2">{errors.exposureType}</p>}
                <div className="flex justify-end mt-4">
                  <button type="button" onClick={() => validateStep() && setStep(2)} className="bg-emerald-500 text-black px-4 py-2 rounded">
                    Next
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label className="block mb-2 font-medium">2) Earliest year of exposure</label>
                <select className="w-full p-2 rounded text-black" value={form.exposureYear} onChange={(e) => update({ exposureYear: e.target.value })}>
                  <option value="">Select year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-white/80 mt-2">
                  If residential, we typically look for substantial use (roughly 2–3+ sprayings/year for 2–3+ years). If occupational, select Occupational above.
                </p>
                {errors.exposureYear && <p className="text-rose-300 text-xs mt-2">{errors.exposureYear}</p>}
                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="text-sm">
                    Back
                  </button>
                  <button type="button" onClick={() => validateStep() && setStep(3)} className="bg-emerald-500 text-black px-4 py-2 rounded">
                    Next
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label className="block mb-2 font-medium">3) Diagnosis details</label>

                <label className="text-sm mb-1 block">Qualifying NHL subtype</label>
                <select className="w-full p-2 rounded text-black" value={form.diagnosis} onChange={(e) => update({ diagnosis: e.target.value })}>
                  <option value="">Select subtype</option>
                  {NHL_SUBTYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.diagnosis && <p className="text-rose-300 text-xs mt-2">{errors.diagnosis}</p>}

                <label className="text-sm mt-4 mb-1 block">Diagnosis year</label>
                <select className="w-full p-2 rounded text-black" value={form.diagnosisYear} onChange={(e) => update({ diagnosisYear: e.target.value })}>
                  <option value="">Select year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {errors.diagnosisYear && <p className="text-rose-300 text-xs mt-2">{errors.diagnosisYear}</p>}

                <label className="text-sm mt-4 mb-1 block">Age at diagnosis</label>
                <input
                  type="number"
                  min="0"
                  max="119"
                  className="w-full p-2 rounded text-black"
                  value={form.ageAtDiagnosis}
                  onChange={(e) => update({ ageAtDiagnosis: e.target.value })}
                />
                {errors.ageAtDiagnosis && <p className="text-rose-300 text-xs mt-2">{errors.ageAtDiagnosis}</p>}

                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(2)} className="text-sm">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateStep()) return;
                      // quick pre-check feedback
                      const ageFail = !(form.ageAtDiagnosis && Number(form.ageAtDiagnosis) < 60);
                      const diagYear = Number(form.diagnosisYear);
                      const yearsAgo = diagYear ? CURRENT_YEAR - diagYear : null;
                      const timeFail = diagYear ? (isOccupational ? yearsAgo > 2 : yearsAgo > 10) : false;
                      if (ageFail || timeFail) {
                        setErrors((prev) => ({ ...prev, hardFail: "Based on age or diagnosis year this case may not meet intake criteria." }));
                      } else {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.hardFail;
                          return copy;
                        });
                      }
                      setStep(4);
                    }}
                    className="bg-emerald-500 text-black px-4 py-2 rounded"
                  >
                    Next
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label className="block mb-2 font-medium">4) Where do you live?</label>
                <select className="w-full p-2 rounded text-black" value={form.state} onChange={(e) => update({ state: e.target.value })}>
                  <option value="">Select state</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.state && <p className="text-rose-300 text-xs mt-2">{errors.state}</p>}

                <label className="block mt-4 mb-2 font-medium">Any of the following apply to you? (select all that apply)</label>
                <div className="grid gap-2">
                  {DISQUALIFIERS.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={Boolean(form.disqualifiers[d.key])} onChange={() => toggleDisqualifier(d.key)} />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>

                <label className="block mt-4 mb-1">Are you currently represented by an attorney for this?</label>
                <select className="w-full p-2 rounded text-black" value={form.represented} onChange={(e) => update({ represented: e.target.value })}>
                  <option value="">Select</option>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>

                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(3)} className="text-sm">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateStep()) return;
                      const ageOk = form.ageAtDiagnosis && Number(form.ageAtDiagnosis) < 60;
                      const diagNum = Number(form.diagnosisYear);
                      const yearsAgo = diagNum ? CURRENT_YEAR - diagNum : null;
                      const timeOk = diagNum ? (isOccupational ? yearsAgo <= 2 : yearsAgo <= 10) : true;
                      const stateOk = STATES.includes(form.state);
                      const anyDisq = Object.values(form.disqualifiers).some(Boolean);
                      if (!ageOk || !timeOk || !stateOk || anyDisq) {
                        setErrors((prev) => ({ ...prev, hardFail: "Based on the information provided, this entry may not meet our intake criteria." }));
                      } else {
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.hardFail;
                          return copy;
                        });
                      }
                      setStep(5);
                    }}
                    className="bg-emerald-500 text-black px-4 py-2 rounded"
                  >
                    Next
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5 */}
            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label className="block mb-2 font-medium">5) Contact details</label>

                <input className="w-full p-2 rounded text-black mb-2" placeholder="First name" value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} />
                {errors.firstName && <p className="text-rose-300 text-xs">{errors.firstName}</p>}

                <input className="w-full p-2 rounded text-black mb-2" placeholder="Last name" value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} />
                {errors.lastName && <p className="text-rose-300 text-xs">{errors.lastName}</p>}

                <input className="w-full p-2 rounded text-black mb-2" placeholder="(555) 123-4567" value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
                {errors.phone && <p className="text-rose-300 text-xs">{errors.phone}</p>}

                <input className="w-full p-2 rounded text-black mb-2" placeholder="you@domain.com" value={form.email} onChange={(e) => update({ email: e.target.value })} />
                {errors.email && <p className="text-rose-300 text-xs">{errors.email}</p>}

                <label className="block mt-4 mb-2 text-xs">
                  <input
                    type="checkbox"
                    id="tcpa_opt_in"
                    name="tcpa_opt_in"
                    checked={form.tcpa_opt_in}
                    onChange={(e) => update({ tcpa_opt_in: e.target.checked })}
                    className="mr-2"
                    required
                  />
                  By clicking ‘submit’ I agree by electronic signature to be contacted by Histora through a live agent, artificial or prerecorded voice, and automated SMS text at my residential or cellular number, dialed manually or by autodialer, and by email. I understand I am not required to sign/agree to this as a condition to purchase.
                </label>
                {errors.tcpa_opt_in && <p className="text-rose-300 text-xs">{errors.tcpa_opt_in}</p>}

                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(4)} className="text-sm">
                    Back
                  </button>
                  <button type="button" onClick={() => (validateStep() ? setStep(6) : null)} className="bg-emerald-500 text-black px-4 py-2 rounded">
                    Review
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 6 - Review + Submit */}
            {step === 6 && (
              <motion.div key="s6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!submitted ? (
                  <>
                    <h2 className="text-lg font-semibold mb-3">6) Review & Submit</h2>

                    <div className="rounded-md bg-white/5 p-4 text-sm mb-4">
                      <ul className="space-y-1">
                        <li>
                          <strong>Exposure:</strong> {form.exposureType} (earliest year: {form.exposureYear})
                        </li>
                        <li>
                          <strong>NHL subtype:</strong> {form.diagnosis} (diagnosis year: {form.diagnosisYear})
                        </li>
                        <li>
                          <strong>Age at diagnosis:</strong> {form.ageAtDiagnosis}
                        </li>
                        <li>
                          <strong>State:</strong> {form.state}
                        </li>
                        <li>
                          <strong>Represented:</strong> {form.represented || "—"}
                        </li>
                        <li>
                          <strong>Name:</strong> {form.firstName} {form.lastName}
                        </li>
                        <li>
                          <strong>Phone:</strong> {form.phone}
                        </li>
                        <li>
                          <strong>Email:</strong> {form.email}
                        </li>
                        <li>
                          <strong>TCPA consent:</strong> {form.tcpa_opt_in ? "Agreed" : "Not agreed"}
                        </li>
                        <li>
                          <strong>TrustedForm cert:</strong> {trustedFormUrl || form.xxTrustedFormCertUrl ? "Captured" : "Pending"}
                        </li>
                        {Object.keys(form.disqualifiers || {}).length > 0 && (
                          <li>
                            <strong>Selected disqualifiers:</strong>{" "}
                            {Object.entries(form.disqualifiers)
                              .filter(([k, v]) => v)
                              .map(([k]) => DISQUALIFIERS.find((d) => d.key === k)?.label)
                              .join(", ") || "None"}
                          </li>
                        )}
                      </ul>
                    </div>

                    {isDisqualified ? (
                      <div className="rounded-md bg-rose-700/30 border border-rose-600 p-3 mb-4 text-sm">
                        <strong>Automatic screen result:</strong> Based on the intake criteria, this entry does not meet our eligibility rules. If you disagree, please review your inputs or call our intake line.
                      </div>
                    ) : (
                      <div className="rounded-md bg-emerald-700/20 border border-emerald-500 p-3 mb-4 text-sm">
                        <strong>Preliminary result:</strong> Based on your answers, you may qualify. Submitting will forward your information to a partner firm for a full review.
                      </div>
                    )}

                    <div className="flex justify-between">
                      <button type="button" onClick={() => setStep(5)} className="text-sm">
                        Back
                      </button>
                      <button type="submit" disabled={submitting || isDisqualified} className={`px-4 py-2 rounded ${submitting || isDisqualified ? "bg-gray-400 text-white" : "bg-emerald-500 text-black"}`}>
                        {submitting ? "Submitting…" : "Get My Free Case Evaluation"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <h3 className="text-2xl font-bold mb-2">Thank you — we received your submission</h3>
                    <p className="text-sm text-white/80">A case specialist will reach out within one business day. If you need urgent assistance call (800) 555-0199.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* TrustedForm noscript fallback */}
        <noscript>
          <img src="https://api.trustedform.com/ns.gif" alt="" />
        </noscript>

        <footer className="mt-8 text-xs text-white/70">
          <p>
            <strong>Disclosures:</strong> This is attorney advertising. Submitting information does not create an attorney-client relationship. Past results do not guarantee similar outcomes. If you cannot be assisted, we may refer you to another firm.
          </p>
        </footer>
      </div>
    </div>
  );
}
