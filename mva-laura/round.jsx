import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Complete, production-ready Roundup eligibility landing page component
 * - Implements hard validation rules from provided criteria PDF
 * - Filters by: state (CA/OR/WA/HI), age (<60 at diagnosis), diagnosis window
 *   (residential: <=10 years, occupational: <=2 years), and disqualifiers
 * - Collects exposure, diagnosis subtype/year/age, basic contact info
 * - Shows clear disqualify messaging when rules fail
 * - Lightweight, no external icon libs required
 *
 * Notes:
 * - Replace the mock submit logic with your intake endpoint
 * - Tailwind classes are used for styling; ensure Tailwind is configured
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

  const [form, setForm] = useState({
    exposureType: "",
    exposureFrequencyPerYear: "",
    exposureYearsDuration: "",
    exposureYear: "",
    diagnosis: "",
    diagnosisYear: "",
    ageAtDiagnosis: "",
    state: "",
    represented: "",
    disqualifiers: {},
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    contactTime: "Anytime",
    notes: "",
    website_url: "", // honeypot
    consent: false,
  });

  // restore/save
  useEffect(() => {
    try {
      const saved = localStorage.getItem("roundup-intake");
      if (saved) setForm(JSON.parse(saved));
    } catch (e) {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("roundup-intake", JSON.stringify(form));
    } catch (e) {}
  }, [form]);

  const progress = useMemo(() => {
    const map = { 1: 16, 2: 32, 3: 48, 4: 64, 5: 80, 6: 100 };
    return map[step] || 0;
  }, [step]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggleDisqualifier = (key) => {
    setForm((f) => ({
      ...f,
      disqualifiers: { ...f.disqualifiers, [key]: !f.disqualifiers[key] },
    }));
  };

  // Derived checks
  const isOccupational = form.exposureType === "Occupational";

  const diagnosisYearNum = Number(form.diagnosisYear) || null;
  const yearsSinceDiagnosis = diagnosisYearNum ? CURRENT_YEAR - diagnosisYearNum : null;

  const failedDisqualifier = Object.values(form.disqualifiers || {}).some(Boolean);

  // Hard validation according to criteria PDF
  const passesAgeRule = form.ageAtDiagnosis !== "" && Number(form.ageAtDiagnosis) < 60;

  const passesDiagnosisWindow = (() => {
    if (!diagnosisYearNum) return true; // can't evaluate yet
    if (isOccupational) {
      // occupational IT&O: within last 2 years required
      return yearsSinceDiagnosis <= 2;
    }
    // residential: within last 10 years
    return yearsSinceDiagnosis <= 10;
  })();

  const passesStateRule = STATES.includes(form.state);

  const isDisqualified = !passesAgeRule || !passesDiagnosisWindow || !passesStateRule || failedDisqualifier;

  const validateStep = () => {
    const e = {};
    if (step === 1 && !form.exposureType) e.exposureType = "Please select exposure type.";
    if (step === 2 && !form.exposureYear) e.exposureYear = "Select earliest year of exposure.";
    if (step === 3) {
      if (!form.diagnosis) e.diagnosis = "Select your NHL subtype.";
      if (!form.diagnosisYear) e.diagnosisYear = "Select diagnosis year.";
      if (!form.ageAtDiagnosis) e.ageAtDiagnosis = "Enter age at diagnosis.";
      if (form.ageAtDiagnosis && Number(form.ageAtDiagnosis) >= 120) e.ageAtDiagnosis = "Enter a realistic age.";
    }
    if (step === 4 && !form.state) e.state = "Choose your state.";
    if (step === 5) {
      if (!form.firstName) e.firstName = "First name required.";
      if (!form.lastName) e.lastName = "Last name required.";
      if (!/^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(form.phone || "")) e.phone = "Enter a valid US phone number.";
      if (!/^\S+@\S+\.\S+$/.test(form.email || "")) e.email = "Enter a valid email address.";
      if (!form.consent) e.consent = "You must agree to be contacted.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev?.preventDefault?.();
    if (!validateStep()) return;

    // enforce hard rules before submit
    if (isDisqualified) {
      // show a consolidated error state
      setErrors((prev) => ({
        ...prev,
        hardFail: "Based on the criteria you provided, this lead does not meet eligibility requirements. If you believe this is an error, review your answers or contact us.",
      }));
      return;
    }

    // honeypot check
    if (form.website_url) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      // Submit to the webhook endpoint
      const response = await fetch('/webhook', { 
        method: 'POST', 
        body: JSON.stringify(form), 
        headers: {'Content-Type':'application/json'} 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Submission result:', result);
      setSubmitted(true);
    } catch (err) {
      console.error('Submission error:', err);
      alert("Submission failed. Call 1-800-555-0199.");
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
            <div className="mt-2 text-xs text-white/80">Hard disqualifiers include: age ≥ 60 at diagnosis, diagnosis outside allowed window (residential ≤10y, occupational ≤2y), residence outside CA/OR/WA/HI, or any matching disqualifying condition/exposure.</div>
          </div>
        )}

        <form onSubmit={onSubmit}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <label className="block mb-2 font-medium">1) How were you exposed to Roundup® / glyphosate?</label>
                <select className="w-full p-2 rounded text-black" value={form.exposureType} onChange={(e) => update({ exposureType: e.target.value })}>
                  <option value="">Select exposure type</option>
                  <option value="Personal use">Personal / Residential use</option>
                  <option value="Occupational">Occupational / IT&O (landscaping, groundskeeping, cemetery, greenskeeping)</option>
                  <option value="Second-hand">Second-hand / Nearby spraying</option>
                </select>
                {errors.exposureType && <p className="text-rose-300 text-xs mt-2">{errors.exposureType}</p>}

                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={() => validateStep() && setStep(2)} className="bg-emerald-500 text-black px-4 py-2 rounded">Next</button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <label className="block mb-2 font-medium">2) Earliest year of exposure</label>
                <select className="w-full p-2 rounded text-black" value={form.exposureYear} onChange={(e) => update({ exposureYear: e.target.value })}>
                  <option value="">Select year</option>
                  {YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
                </select>
                <p className="text-sm text-white/80 mt-2">If residential, we typically look for substantial use (roughly 2–3+ sprayings/year for 2–3+ years). If occupational, select Occupational above.</p>
                {errors.exposureYear && <p className="text-rose-300 text-xs mt-2">{errors.exposureYear}</p>}

                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="text-sm">Back</button>
                  <button type="button" onClick={() => validateStep() && setStep(3)} className="bg-emerald-500 text-black px-4 py-2 rounded">Next</button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <label className="block mb-2 font-medium">3) Diagnosis details</label>
                <label className="text-sm mb-1 block">Qualifying NHL subtype</label>
                <select className="w-full p-2 rounded text-black" value={form.diagnosis} onChange={(e) => update({ diagnosis: e.target.value })}>
                  <option value="">Select subtype</option>
                  {NHL_SUBTYPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                {errors.diagnosis && <p className="text-rose-300 text-xs mt-2">{errors.diagnosis}</p>}

                <label className="text-sm mt-4 mb-1 block">Diagnosis year</label>
                <select className="w-full p-2 rounded text-black" value={form.diagnosisYear} onChange={(e) => update({ diagnosisYear: e.target.value })}>
                  <option value="">Select year</option>
                  {YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
                </select>
                {errors.diagnosisYear && <p className="text-rose-300 text-xs mt-2">{errors.diagnosisYear}</p>}

                <label className="text-sm mt-4 mb-1 block">Age at diagnosis</label>
                <input type="number" min="0" max="119" className="w-full p-2 rounded text-black" value={form.ageAtDiagnosis} onChange={(e) => update({ ageAtDiagnosis: e.target.value })} />
                {errors.ageAtDiagnosis && <p className="text-rose-300 text-xs mt-2">{errors.ageAtDiagnosis}</p>}

                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(2)} className="text-sm">Back</button>
                  <button type="button" onClick={() => {
                    if (!validateStep()) return;
                    // quick pre-check for age & timeframe so user sees immediate feedback
                    const ageFail = !(form.ageAtDiagnosis && Number(form.ageAtDiagnosis) < 60);
                    const diagYear = Number(form.diagnosisYear);
                    const yearsAgo = diagYear ? (CURRENT_YEAR - diagYear) : null;
                    const timeFail = diagYear ? (isOccupational ? (yearsAgo > 2) : (yearsAgo > 10)) : false;
                    if (ageFail || timeFail) {
                      setErrors((prev) => ({ ...prev, hardFail: 'Based on age or diagnosis year this case may not meet intake criteria.' }));
                    } else {
                      setErrors((prev) => { const copy = { ...prev }; delete copy.hardFail; return copy; });
                    }
                    setStep(4);
                  }} className="bg-emerald-500 text-black px-4 py-2 rounded">Next</button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <label className="block mb-2 font-medium">4) Where do you live?</label>
                <select className="w-full p-2 rounded text-black" value={form.state} onChange={(e) => update({ state: e.target.value })}>
                  <option value="">Select state</option>
                  {STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
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
                  <button type="button" onClick={() => setStep(3)} className="text-sm">Back</button>
                  <button type="button" onClick={() => {
                    if (!validateStep()) return;
                    // evaluate hard fails now and surface to user on review
                    const ageOk = form.ageAtDiagnosis && Number(form.ageAtDiagnosis) < 60;
                    const diagNum = Number(form.diagnosisYear);
                    const yearsAgo = diagNum ? (CURRENT_YEAR - diagNum) : null;
                    const timeOk = diagNum ? (isOccupational ? (yearsAgo <= 2) : (yearsAgo <= 10)) : true;
                    const stateOk = STATES.includes(form.state);
                    const anyDisq = Object.values(form.disqualifiers).some(Boolean);
                    if (!ageOk || !timeOk || !stateOk || anyDisq) {
                      setErrors((prev) => ({ ...prev, hardFail: 'Based on the information provided, this entry may not meet our intake criteria.' }));
                    } else {
                      setErrors((prev) => { const c = { ...prev }; delete c.hardFail; return c; });
                    }
                    setStep(5);
                  }} className="bg-emerald-500 text-black px-4 py-2 rounded">Next</button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <label className="block mb-2 font-medium">5) Contact details</label>
                <label className="text-sm block mt-2">First name</label>
                <input className="w-full p-2 rounded text-black" value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} />
                {errors.firstName && <p className="text-rose-300 text-xs">{errors.firstName}</p>}

                <label className="text-sm block mt-2">Last name</label>
                <input className="w-full p-2 rounded text-black" value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} />
                {errors.lastName && <p className="text-rose-300 text-xs">{errors.lastName}</p>}

                <label className="text-sm block mt-2">Phone</label>
                <input className="w-full p-2 rounded text-black" value={form.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="(555) 123-4567" />
                {errors.phone && <p className="text-rose-300 text-xs">{errors.phone}</p>}

                <label className="text-sm block mt-2">Email</label>
                <input className="w-full p-2 rounded text-black" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@domain.com" />
                {errors.email && <p className="text-rose-300 text-xs">{errors.email}</p>}

                <label className="block mt-4 mb-2 text-xs">
                  <input type="checkbox" checked={form.consent} onChange={(e) => update({ consent: e.target.checked })} className="mr-2" />
                  By submitting you agree to be contacted by phone, SMS, and email by participating law firms and their agents. Consent is not required to receive services. Message/data rates may apply.
                </label>
                {errors.consent && <p className="text-rose-300 text-xs">{errors.consent}</p>}

                <div className="mt-4 flex justify-between">
                  <button type="button" onClick={() => setStep(4)} className="text-sm">Back</button>
                  <button type="button" onClick={() => { if (validateStep()) setStep(6); }} className="bg-emerald-500 text-black px-4 py-2 rounded">Review</button>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div key="s6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                {!submitted ? (
                  <>
                    <h2 className="text-lg font-semibold mb-3">6) Review & Submit</h2>
                    <div className="rounded-md bg-white/5 p-4 text-sm mb-4">
                      <ul className="space-y-1">
                        <li><strong>Exposure:</strong> {form.exposureType} (earliest year: {form.exposureYear})</li>
                        <li><strong>NHL subtype:</strong> {form.diagnosis} (diagnosis year: {form.diagnosisYear})</li>
                        <li><strong>Age at diagnosis:</strong> {form.ageAtDiagnosis}</li>
                        <li><strong>State:</strong> {form.state}</li>
                        <li><strong>Represented:</strong> {form.represented || "—"}</li>
                        <li><strong>Name:</strong> {form.firstName} {form.lastName}</li>
                        <li><strong>Phone:</strong> {form.phone}</li>
                        <li><strong>Email:</strong> {form.email}</li>
                        {Object.keys(form.disqualifiers || {}).length > 0 && (
                          <li><strong>Selected disqualifiers:</strong> {Object.entries(form.disqualifiers).filter(([k,v])=>v).map(([k])=>DISQUALIFIERS.find(d=>d.key===k)?.label).join(", ") || "None"}</li>
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
                      <button type="button" onClick={() => setStep(5)} className="text-sm">Back</button>
                      <button type="submit" disabled={submitting || isDisqualified} className={`px-4 py-2 rounded ${submitting || isDisqualified ? "bg-gray-400 text-white" : "bg-emerald-500 text-black"}`}>
                        {submitting ? "Submitting…" : "Submit for review"}
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

        <footer className="mt-8 text-xs text-white/70">
          <p><strong>Disclosures:</strong> This is attorney advertising. Submitting information does not create an attorney-client relationship. Past results do not guarantee similar outcomes. If you cannot be assisted, we may refer you to another firm.</p>
        </footer>
      </div>
    </div>
  );
}
