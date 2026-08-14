import React, { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://dob-live-api.onrender.com';
const OFFICE_PHONE = import.meta.env.VITE_OFFICE_PHONE || '0121 751 9038';

// Brand
const NAVY  = '#14233F';
const RED   = '#C8102E';
const WHITE = '#ffffff';
const BG    = '#f7f8fa';
const DARK  = '#111827';
const MUTED = '#6b7280';
const BORDER = '#d1d5db';

// ── Step definitions ───────────────────────────────────────────────────────
// requiredFields: must be truthy to enable Continue on this step
// patchFields:    fields included in the PATCH body from this step
const STEPS = [
  {
    id: 'address',
    title: 'What is your home address?',
    why: 'So we can post your ID card and anything else you need.',
    requiredFields: ['address_line_1', 'city', 'postcode'],
    patchFields: ['address_line_1', 'address_line_2', 'city', 'postcode'],
  },
  {
    id: 'dob',
    title: 'What is your date of birth?',
    why: 'We need this to check your SIA licence is really yours.',
    requiredFields: ['date_of_birth'],
    patchFields: ['date_of_birth'],
  },
  {
    id: 'ni',
    title: 'What is your National Insurance number?',
    why: 'HMRC needs this so your tax record is right. It is on your payslip, your NI card, or in the HMRC app. It looks like QQ 12 34 56 C.',
    requiredFields: ['ni_number'],
    patchFields: ['ni_number'],
  },
  {
    id: 'email',
    title: 'What is your personal email address?',
    why: 'So we can send you your invoices and pay information somewhere you will actually see them.',
    requiredFields: ['personal_email'],
    patchFields: ['personal_email'],
  },
  {
    id: 'nationality',
    title: 'What is your nationality?',
    why: 'We are required by law to check everyone has the right to work in the UK.',
    requiredFields: ['nationality'],
    patchFields: ['nationality'],
  },
  {
    id: 'emergency',
    title: 'Who should we call if something happens to you at work?',
    why: 'If you are hurt on shift, we need to know who to ring. Nobody else sees this.',
    requiredFields: ['nok_name', 'nok_phone'],
    patchFields: ['nok_name', 'nok_relationship', 'nok_phone'],
  },
  {
    id: 'payment_type',
    title: 'How do you invoice us?',
    why: null,
    requiredFields: [],
    patchFields: [],
  },
  {
    id: 'bank',
    title: 'Where should we send your pay?',
    why: 'So we can pay you. Without these we cannot.',
    requiredFields: ['bank_account_holder', 'bank_sort_code', 'bank_account_number'],
    patchFields: ['bank_name', 'bank_account_holder', 'bank_sort_code', 'bank_account_number'],
  },
  {
    id: 'utr',
    title: 'What is your UTR number?',
    why: 'You got this from HMRC when you registered as self-employed. It is ten numbers. It is on any letter from HMRC, or in the HMRC app under Self Assessment. We need it because you invoice us instead of being on our payroll.',
    requiredFields: ['utr_number'],
    patchFields: ['utr_number'],
  },
  {
    id: 'company',
    title: 'Tell us about your company.',
    why: 'We need these so your invoices are legal.',
    requiredFields: ['company_name'],
    patchFields: ['company_name', 'company_address', 'company_reg_number', 'company_vat_number'],
    companyOnly: true,
  },
  {
    id: 'declaration',
    title: 'Self-employment declaration.',
    why: null,
    requiredFields: ['self_employment_declaration'],
    patchFields: ['self_employment_declaration'],
  },
  {
    id: 'terms',
    title: 'Our terms.',
    why: null,
    requiredFields: ['terms_accepted'],
    patchFields: ['terms_accepted'],
  },
  {
    id: 'gdpr',
    title: 'How we use your information.',
    why: null,
    requiredFields: ['gdpr_consent'],
    patchFields: ['gdpr_consent'],
  },
];

// Fields whose values we never show back to the officer — only "✓ Saved"
const SENSITIVE = new Set(['ni_number', 'bank_sort_code', 'bank_account_number', 'utr_number']);

// ── Helpers ────────────────────────────────────────────────────────────────

function getApplicableSteps(isCompany) {
  return STEPS.filter(s => {
    if (s.id === 'payment_type') return isCompany === null; // only present until answered
    if (s.companyOnly) return isCompany === true;
    return true;
  });
}

function isStepDone(step, filledFields, answers, isCompany) {
  if (step.id === 'payment_type') return false; // in array only when unanswered
  if (step.companyOnly && isCompany !== true) return true;
  return step.requiredFields.every(
    f => filledFields[f] === true || Boolean(answers[f])
  );
}

function findResumeIndex(steps, filledFields, answers, isCompany) {
  const idx = steps.findIndex(s => !isStepDone(s, filledFields, answers, isCompany));
  return idx === -1 ? steps.length : idx;
}

function maskValue(field, value) {
  if (!value) return '';
  if (!SENSITIVE.has(field)) return value;
  const s = String(value);
  if (s.length <= 4) return '••••';
  return '•'.repeat(s.length - 4) + s.slice(-4);
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  page: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    overflowY: 'auto', background: BG,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 20,
    background: NAVY,
    padding: '0 8px',
    height: 56,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: WHITE, fontSize: 24, padding: '8px 12px',
    minWidth: 48, minHeight: 48, display: 'flex', alignItems: 'center',
    borderRadius: 8,
  },
  stepLabel: {
    color: '#94a3b8', fontSize: 14, fontWeight: 500,
    paddingRight: 16,
  },
  body: {
    padding: '32px 24px 8px',
    maxWidth: 480, margin: '0 auto',
  },
  title: {
    fontSize: 26, fontWeight: 700, color: DARK, lineHeight: 1.25,
    marginBottom: 16,
  },
  why: {
    fontSize: 15, color: MUTED, lineHeight: 1.6,
    background: '#f3f4f6', borderLeft: `4px solid ${BORDER}`,
    padding: '12px 16px', borderRadius: '0 8px 8px 0',
    marginBottom: 28,
  },
  label: {
    display: 'block', fontSize: 14, fontWeight: 600,
    color: DARK, marginBottom: 6,
  },
  field: { marginBottom: 20 },
  input: {
    width: '100%', fontSize: 16, padding: '15px 16px',
    border: `2px solid ${BORDER}`, borderRadius: 10,
    outline: 'none', fontFamily: 'inherit',
    color: DARK, background: WHITE, minHeight: 56,
    boxSizing: 'border-box', appearance: 'none',
    WebkitAppearance: 'none',
  },
  inputFocus: { borderColor: NAVY },
  footer: {
    position: 'sticky', bottom: 0, zIndex: 10,
    background: WHITE, borderTop: `1px solid ${BORDER}`,
    padding: '16px 24px max(env(safe-area-inset-bottom), 16px)',
    maxWidth: 480, margin: '0 auto',
    width: '100%',
  },
  continueBtn: {
    width: '100%', padding: '18px 24px',
    background: NAVY, color: WHITE, border: 'none',
    borderRadius: 12, fontSize: 18, fontWeight: 600,
    cursor: 'pointer', minHeight: 56,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  continueBtnDisabled: {
    background: '#d1d5db', cursor: 'not-allowed',
  },
  savedBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#f0fdf4', border: '1px solid #86efac',
    borderRadius: 8, padding: '10px 16px',
    fontSize: 14, color: '#15803d', marginBottom: 16,
  },
  errorBadge: {
    background: '#fef2f2', border: `1px solid #fca5a5`,
    borderRadius: 8, padding: '10px 16px',
    fontSize: 14, color: RED, marginBottom: 16,
  },
  optionBtn: {
    width: '100%', padding: '20px 24px',
    border: `2px solid ${BORDER}`, borderRadius: 12,
    background: WHITE, cursor: 'pointer', marginBottom: 16,
    textAlign: 'left', fontSize: 17, fontWeight: 600, color: DARK,
    minHeight: 64,
  },
  optionBtnSub: {
    display: 'block', fontSize: 14, fontWeight: 400, color: MUTED, marginTop: 4,
  },
  checkRow: {
    display: 'flex', alignItems: 'flex-start', gap: 16,
    padding: '20px 20px', border: `2px solid ${BORDER}`, borderRadius: 12,
    cursor: 'pointer', background: WHITE, marginBottom: 16, minHeight: 64,
    textAlign: 'left', width: '100%',
  },
  checkBox: (checked) => ({
    width: 28, height: 28, minWidth: 28,
    border: `2px solid ${checked ? NAVY : BORDER}`,
    borderRadius: 6, background: checked ? NAVY : WHITE,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  }),
};

// ── Sub-components ─────────────────────────────────────────────────────────

function Checkbox({ checked, label, sublabel, onChange }) {
  return (
    <button type="button" onClick={onChange} style={S.checkRow}>
      <div style={S.checkBox(checked)}>
        {checked && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3.5 3.5L13 4" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: DARK, lineHeight: 1.4 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 14, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{sublabel}</div>}
      </div>
    </button>
  );
}

function FocusInput({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={{ ...S.input, ...(focused ? S.inputFocus : {}), ...(style || {}) }}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

function Field({ label, required, children }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}{required && <span style={{ color: RED }}> *</span>}</label>
      {children}
    </div>
  );
}

function SavedBadge({ state, errorMsg, onRetry }) {
  if (state === 'saved') {
    return (
      <div style={S.savedBadge}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="#15803d">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
        Saved
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div style={S.errorBadge}>
        Could not save — check your signal.{' '}
        <button onClick={onRetry} style={{ color: RED, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}>
          Try again
        </button>
      </div>
    );
  }
  return null;
}

// ── Screen shell ───────────────────────────────────────────────────────────

function Screen({ title, why, children, stepLabel, onBack, onContinue, continueLabel = 'Continue →', continueDisabled, saveState, saveErrorMsg, onRetry }) {
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ minWidth: 48 }}>
          {onBack && (
            <button onClick={onBack} style={S.backBtn} aria-label="Back">
              ←
            </button>
          )}
        </div>
        {stepLabel && <span style={S.stepLabel}>{stepLabel}</span>}
      </div>

      {/* Body */}
      <div style={S.body}>
        <SavedBadge state={saveState} errorMsg={saveErrorMsg} onRetry={onRetry} />

        {title && <h1 style={S.title}>{title}</h1>}
        {why && <p style={S.why}>{why}</p>}
        {children}

        {/* Spacer so last input isn't hidden behind sticky footer */}
        <div style={{ height: 120 }} />
      </div>

      {/* Sticky footer */}
      {onContinue && (
        <div style={S.footer}>
          <button
            onClick={onContinue}
            disabled={continueDisabled || saveState === 'saving'}
            style={{
              ...S.continueBtn,
              ...(continueDisabled || saveState === 'saving' ? S.continueBtnDisabled : {}),
            }}
          >
            {saveState === 'saving' ? 'Saving…' : continueLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Review row ─────────────────────────────────────────────────────────────

function ReviewSection({ title, rows, onEdit }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 15, color: row.value ? DARK : '#e5e7eb', fontWeight: row.value ? 500 : 400 }}>
                {row.value || '—'}
              </div>
            </div>
            {row.stepId && (
              <button onClick={() => onEdit(row.stepId)} style={{ color: NAVY, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px', whiteSpace: 'nowrap', minHeight: 36 }}>
                Change
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function JoinForm() {
  // Primary: token is the last non-empty path segment of /onboarding/<token>
  // Fallback: ?t= query param, kept for manually-created test links.
  const token = (() => {
    const fromPath = window.location.pathname.split('/').filter(Boolean).pop() || null;
    if (fromPath && !['join.html', 'join'].includes(fromPath)) return fromPath;
    return new URLSearchParams(window.location.search).get('t');
  })();

  // App-level state
  const [appState, setAppState] = useState('loading'); // loading | error | form | done
  const [firstName, setFirstName]   = useState('');
  const [filledFields, setFilledFields] = useState({}); // flags from API, updated after each PATCH
  const [isCompany, setIsCompany]   = useState(null);   // null | true | false

  // Form navigation
  const [stepIndex, setStepIndex]   = useState(0);
  const [onReview, setOnReview]     = useState(false);
  const [fromReview, setFromReview] = useState(false);  // editing a step from review → go back after save

  // Per-step answer values for this session
  const [answers, setAnswers]       = useState({});

  // Save feedback
  const [saveState, setSaveState]   = useState('idle'); // idle | saving | saved | error
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null); // held for retry

  // Complete
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setAppState('error'); return; }

    fetch(`${API}/api/onboarding/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('invalid');
        return r.json();
      })
      .then(data => {
        const ff = data.fields || {};
        setFirstName(data.first_name || '');
        setFilledFields(ff);

        // invoices_via_company is returned as an actual value (null | true | false),
        // not as a presence flag, so we can skip the routing question on resume.
        const company = data.invoices_via_company ?? null;
        setIsCompany(company);

        const steps = getApplicableSteps(company);
        const idx = findResumeIndex(steps, ff, {}, company);
        if (idx >= steps.length) {
          setOnReview(true);
        } else {
          setStepIndex(idx);
        }
        setAppState('form');
      })
      .catch(() => setAppState('error'));
  }, [token]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setAnswer = useCallback((field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  }, []);

  const steps = getApplicableSteps(isCompany);
  const step  = steps[stepIndex] ?? null;

  const isStepEnabled = (s) => isStepDone(s, filledFields, answers, isCompany);

  const stepLabel = !onReview && step
    ? `Step ${stepIndex + 1} of ${steps.length}`
    : null;

  // ── Save ──────────────────────────────────────────────────────────────────

  const doSave = useCallback(async (payload) => {
    setSaveState('saving');
    setSaveErrorMsg('');
    try {
      const r = await fetch(`${API}/api/onboarding/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Could not save');
      }
      // Mark these fields as filled
      setFilledFields(prev => {
        const u = { ...prev };
        for (const [k, v] of Object.entries(payload)) {
          if (k !== 'onboarding_step') u[k] = Boolean(v);
        }
        return u;
      });
      setPendingPayload(null);
      setSaveState('saved');
      setTimeout(() => setSaveState(s => s === 'saved' ? 'idle' : s), 2500);
      return true;
    } catch (e) {
      setSaveErrorMsg(e.message || 'Could not save. Check your signal.');
      setSaveState('error');
      return false;
    }
  }, [token]);

  const handleRetry = useCallback(() => {
    if (pendingPayload) doSave(pendingPayload);
  }, [pendingPayload, doSave]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const advance = useCallback(() => {
    if (fromReview) {
      setFromReview(false);
      setOnReview(true);
    } else if (stepIndex + 1 >= steps.length) {
      setOnReview(true);
    } else {
      setStepIndex(i => i + 1);
    }
  }, [fromReview, stepIndex, steps.length]);

  const handleBack = useCallback(() => {
    if (onReview) {
      // Find last step and go there
      setOnReview(false);
      setStepIndex(steps.length - 1);
      return;
    }
    if (stepIndex > 0) setStepIndex(i => i - 1);
  }, [onReview, stepIndex, steps.length]);

  const handleContinue = useCallback(async () => {
    if (!step) { setOnReview(true); return; }

    // Routing step — handled by handleChoosePaymentType, not this path
    if (step.id === 'payment_type') { advance(); return; }

    // Build payload from answers entered this session for this step's fields
    const payload = {};
    for (const f of step.patchFields) {
      if (answers[f] !== undefined) payload[f] = answers[f];
    }
    payload.onboarding_step = stepIndex + 1;

    // If nothing new and all required were already filled, just advance
    const noNewAnswers  = step.patchFields.every(f => answers[f] === undefined);
    const allPreFilled  = step.requiredFields.every(f => filledFields[f]);
    if (noNewAnswers && allPreFilled) { advance(); return; }

    setPendingPayload(payload);
    const ok = await doSave(payload);
    if (ok) advance();
  }, [step, stepIndex, answers, filledFields, advance, doSave]);

  const handleChoosePaymentType = useCallback(async (type) => {
    const company = type === 'company';
    setIsCompany(company);
    // Persist server-side so the question is never re-asked on resume
    await doSave({ invoices_via_company: company, onboarding_step: stepIndex + 1 });
    // Recompute position from scratch — payment_type is removed from the step array
    // once answered, so indices shift and advance() would land on the wrong step.
    const newSteps = getApplicableSteps(company);
    const nextIdx = findResumeIndex(newSteps, filledFields, answers, company);
    if (nextIdx >= newSteps.length) {
      setOnReview(true);
    } else {
      setStepIndex(nextIdx);
    }
  }, [doSave, stepIndex, filledFields, answers]);

  const handleEditStep = useCallback((stepId) => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx !== -1) {
      setStepIndex(idx);
      setFromReview(true);
      setOnReview(false);
    }
  }, [steps]);

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    setCompleteError('');
    try {
      const r = await fetch(`${API}/api/onboarding/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 422 && data.missing?.length) {
          // Find first step that has a missing field and navigate there
          const firstBad = steps.findIndex(s =>
            s.requiredFields.some(f => data.missing.includes(f))
          );
          if (firstBad !== -1) {
            setOnReview(false);
            setStepIndex(firstBad);
            setFromReview(true);
          }
          setCompleteError('Some answers are still missing. We have taken you back to the first one.');
          return;
        }
        throw new Error(data.error || 'Could not submit');
      }
      setAppState('done');
    } catch (e) {
      setCompleteError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setCompleting(false);
    }
  }, [token, steps]);

  // ── Step-level continue enabled? ──────────────────────────────────────────

  const continueEnabled = step ? isStepEnabled(step) : false;

  // ── Render ────────────────────────────────────────────────────────────────

  if (appState === 'loading') return <LoadingScreen />;
  if (appState === 'error')   return <ErrorScreen />;
  if (appState === 'done')    return <DoneScreen firstName={firstName} />;

  if (onReview) {
    return (
      <ReviewScreen
        steps={steps}
        answers={answers}
        filledFields={filledFields}
        isCompany={isCompany}
        onEdit={handleEditStep}
        onBack={() => { setOnReview(false); setStepIndex(steps.length - 1); }}
        onSubmit={handleComplete}
        completing={completing}
        completeError={completeError}
      />
    );
  }

  if (!step) return null;

  return (
    <StepScreen
      step={step}
      stepLabel={stepLabel}
      answers={answers}
      filledFields={filledFields}
      isCompany={isCompany}
      saveState={saveState}
      saveErrorMsg={saveErrorMsg}
      continueEnabled={continueEnabled}
      fromReview={fromReview}
      onAnswer={setAnswer}
      onBack={stepIndex > 0 ? handleBack : null}
      onContinue={handleContinue}
      onRetry={handleRetry}
      onChoosePaymentType={handleChoosePaymentType}
    />
  );
}

// ── Loading ────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 40, height: 40, border: `4px solid #e5e7eb`, borderTopColor: NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: MUTED, fontSize: 16 }}>Loading…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Error ──────────────────────────────────────────────────────────────────

function ErrorScreen() {
  return (
    <div style={S.page}>
      <div style={{ ...S.header, justifyContent: 'center' }}>
        <span style={{ color: WHITE, fontSize: 16, fontWeight: 600 }}>DOB Live</span>
      </div>
      <div style={{ ...S.body, paddingTop: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>😔</div>
        <h1 style={{ ...S.title, textAlign: 'center', marginBottom: 16 }}>
          This link is not working
        </h1>
        <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, marginBottom: 40, maxWidth: 340, margin: '0 auto 40px' }}>
          We cannot open this link right now. Please ring the office and we will get it sorted.
        </p>
        <a
          href={`tel:${OFFICE_PHONE.replace(/\s/g, '')}`}
          style={{
            display: 'block', background: NAVY, color: WHITE,
            fontSize: 20, fontWeight: 700, padding: '20px 32px',
            borderRadius: 12, textDecoration: 'none', maxWidth: 320, margin: '0 auto',
          }}
        >
          📞 {OFFICE_PHONE}
        </a>
      </div>
    </div>
  );
}

// ── Done ───────────────────────────────────────────────────────────────────

function DoneScreen({ firstName }) {
  return (
    <div style={S.page}>
      <div style={{ ...S.header, justifyContent: 'center' }}>
        <span style={{ color: WHITE, fontSize: 16, fontWeight: 600 }}>DOB Live</span>
      </div>
      <div style={{ ...S.body, paddingTop: 64, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>✅</div>
        <h1 style={{ ...S.title, textAlign: 'center', fontSize: 30, marginBottom: 16 }}>
          That is everything.{firstName ? ` Thanks, ${firstName}.` : ' Thanks.'}
        </h1>
        <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.7 }}>
          We have got everything we need. You will hear from us soon.
        </p>
      </div>
    </div>
  );
}

// ── Step screen dispatcher ─────────────────────────────────────────────────

function StepScreen({ step, stepLabel, answers, filledFields, isCompany, saveState, saveErrorMsg, continueEnabled, fromReview, onAnswer, onBack, onContinue, onRetry, onChoosePaymentType }) {
  const continueLabel = fromReview ? 'Save & back to review →' : 'Continue →';

  // payment_type is a special routing step — handled inside its own render
  if (step.id === 'payment_type') {
    return (
      <Screen
        title={step.title}
        stepLabel={stepLabel}
        onBack={onBack}
        saveState={saveState}
        saveErrorMsg={saveErrorMsg}
        onRetry={onRetry}
        // No footer button — user taps one of the two option buttons below
      >
        <button
          style={S.optionBtn}
          onClick={() => onChoosePaymentType('person')}
        >
          As myself
          <span style={S.optionBtnSub}>I invoice as an individual</span>
        </button>
        <button
          style={S.optionBtn}
          onClick={() => onChoosePaymentType('company')}
        >
          Through a limited company
          <span style={S.optionBtnSub}>The invoice comes from my company</span>
        </button>
      </Screen>
    );
  }

  // Checkbox steps (declaration, terms, gdpr)
  if (['declaration', 'terms', 'gdpr'].includes(step.id)) {
    return (
      <Screen
        title={step.title}
        stepLabel={stepLabel}
        onBack={onBack}
        onContinue={onContinue}
        continueLabel={continueLabel}
        continueDisabled={!continueEnabled}
        saveState={saveState}
        saveErrorMsg={saveErrorMsg}
        onRetry={onRetry}
      >
        <CheckStep step={step} answers={answers} filledFields={filledFields} onAnswer={onAnswer} />
      </Screen>
    );
  }

  return (
    <Screen
      title={step.title}
      why={step.why}
      stepLabel={stepLabel}
      onBack={onBack}
      onContinue={onContinue}
      continueLabel={continueLabel}
      continueDisabled={!continueEnabled}
      saveState={saveState}
      saveErrorMsg={saveErrorMsg}
      onRetry={onRetry}
    >
      <FieldStep step={step} answers={answers} filledFields={filledFields} onAnswer={onAnswer} />
    </Screen>
  );
}

// ── Field steps ────────────────────────────────────────────────────────────

function FieldStep({ step, answers, filledFields, onAnswer }) {
  // Some steps need to show a "previously saved" hint when the field was filled before
  // but we don't have the value (sensitive fields).
  const hint = (field) => {
    if (filledFields[field] && answers[field] === undefined && SENSITIVE.has(field)) {
      return 'Previously saved — re-enter to update';
    }
    if (filledFields[field] && answers[field] === undefined) {
      return 'Previously saved — tap to update';
    }
    return undefined;
  };

  const val = (field) => answers[field] ?? '';

  switch (step.id) {
    case 'address':
      return (
        <>
          <Field label="House or flat number and street" required>
            <FocusInput
              type="text"
              value={val('address_line_1')}
              placeholder={hint('address_line_1') || 'e.g. 42 High Street'}
              autoComplete="address-line1"
              onChange={e => onAnswer('address_line_1', e.target.value)}
            />
          </Field>
          <Field label="Flat, building, floor (optional)">
            <FocusInput
              type="text"
              value={val('address_line_2')}
              placeholder={hint('address_line_2') || 'e.g. Flat 3'}
              autoComplete="address-line2"
              onChange={e => onAnswer('address_line_2', e.target.value)}
            />
          </Field>
          <Field label="Town or city" required>
            <FocusInput
              type="text"
              value={val('city')}
              placeholder={hint('city') || 'e.g. London'}
              autoComplete="address-level2"
              onChange={e => onAnswer('city', e.target.value)}
            />
          </Field>
          <Field label="Postcode" required>
            <FocusInput
              type="text"
              value={val('postcode')}
              placeholder={hint('postcode') || 'e.g. SW1A 1AA'}
              autoComplete="postal-code"
              style={{ textTransform: 'uppercase' }}
              onChange={e => onAnswer('postcode', e.target.value.toUpperCase())}
            />
          </Field>
        </>
      );

    case 'dob':
      return (
        <Field label="Date of birth" required>
          <FocusInput
            type="date"
            value={val('date_of_birth')}
            autoComplete="bday"
            max={new Date().toISOString().split('T')[0]}
            onChange={e => onAnswer('date_of_birth', e.target.value)}
          />
        </Field>
      );

    case 'ni':
      return (
        <Field label="National Insurance number" required>
          <FocusInput
            type="text"
            value={val('ni_number')}
            placeholder={hint('ni_number') || 'AB 12 34 56 C'}
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={13}
            onChange={e => onAnswer('ni_number', e.target.value.toUpperCase())}
          />
        </Field>
      );

    case 'email':
      return (
        <Field label="Personal email" required>
          <FocusInput
            type="email"
            value={val('personal_email')}
            placeholder={hint('personal_email') || 'your@email.com'}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            onChange={e => onAnswer('personal_email', e.target.value)}
          />
        </Field>
      );

    case 'nationality':
      return (
        <Field label="Nationality" required>
          <FocusInput
            type="text"
            value={val('nationality')}
            placeholder={hint('nationality') || 'e.g. British'}
            autoComplete="off"
            onChange={e => onAnswer('nationality', e.target.value)}
          />
        </Field>
      );

    case 'emergency':
      return (
        <>
          <Field label="Their name" required>
            <FocusInput
              type="text"
              value={val('nok_name')}
              placeholder={hint('nok_name') || 'e.g. Sarah Jones'}
              autoComplete="off"
              onChange={e => onAnswer('nok_name', e.target.value)}
            />
          </Field>
          <Field label="How do you know them? (optional)">
            <FocusInput
              type="text"
              value={val('nok_relationship')}
              placeholder={hint('nok_relationship') || 'e.g. Partner, Mum, Friend'}
              autoComplete="off"
              onChange={e => onAnswer('nok_relationship', e.target.value)}
            />
          </Field>
          <Field label="Their phone number" required>
            <FocusInput
              type="tel"
              value={val('nok_phone')}
              placeholder={hint('nok_phone') || '07700 900000'}
              inputMode="tel"
              autoComplete="tel"
              onChange={e => onAnswer('nok_phone', e.target.value)}
            />
          </Field>
        </>
      );

    case 'bank':
      return (
        <>
          <Field label="Bank name (optional)">
            <FocusInput
              type="text"
              value={val('bank_name')}
              placeholder={hint('bank_name') || 'e.g. Barclays'}
              autoComplete="off"
              onChange={e => onAnswer('bank_name', e.target.value)}
            />
          </Field>
          <Field label="Account holder name" required>
            <FocusInput
              type="text"
              value={val('bank_account_holder')}
              placeholder={hint('bank_account_holder') || 'Name as it appears on your bank card'}
              autoComplete="name"
              onChange={e => onAnswer('bank_account_holder', e.target.value)}
            />
          </Field>
          <Field label="Sort code" required>
            <FocusInput
              type="text"
              value={val('bank_sort_code')}
              placeholder={hint('bank_sort_code') || '12-34-56'}
              inputMode="numeric"
              maxLength={8}
              autoComplete="off"
              onChange={e => onAnswer('bank_sort_code', e.target.value)}
            />
          </Field>
          <Field label="Account number" required>
            <FocusInput
              type="text"
              value={val('bank_account_number')}
              placeholder={hint('bank_account_number') || '12345678'}
              inputMode="numeric"
              maxLength={8}
              autoComplete="off"
              onChange={e => onAnswer('bank_account_number', e.target.value)}
            />
          </Field>
        </>
      );

    case 'utr':
      return (
        <Field label="UTR number" required>
          <FocusInput
            type="text"
            value={val('utr_number')}
            placeholder={hint('utr_number') || '1234567890'}
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
            onChange={e => onAnswer('utr_number', e.target.value.replace(/\D/g, ''))}
          />
        </Field>
      );

    case 'company':
      return (
        <>
          <Field label="Company name" required>
            <FocusInput
              type="text"
              value={val('company_name')}
              placeholder={hint('company_name') || 'e.g. Jones Security Ltd'}
              autoComplete="organization"
              onChange={e => onAnswer('company_name', e.target.value)}
            />
          </Field>
          <Field label="Company address (optional)">
            <FocusInput
              type="text"
              value={val('company_address')}
              placeholder={hint('company_address') || 'Registered address'}
              autoComplete="off"
              onChange={e => onAnswer('company_address', e.target.value)}
            />
          </Field>
          <Field label="Company registration number (optional)">
            <FocusInput
              type="text"
              value={val('company_reg_number')}
              placeholder={hint('company_reg_number') || 'e.g. 12345678'}
              inputMode="numeric"
              autoComplete="off"
              onChange={e => onAnswer('company_reg_number', e.target.value)}
            />
          </Field>
          <Field label="VAT number (optional — only if VAT registered)">
            <FocusInput
              type="text"
              value={val('company_vat_number')}
              placeholder={hint('company_vat_number') || 'e.g. GB123456789'}
              autoComplete="off"
              onChange={e => onAnswer('company_vat_number', e.target.value)}
            />
          </Field>
        </>
      );

    default:
      return null;
  }
}

// ── Checkbox steps ─────────────────────────────────────────────────────────

function CheckStep({ step, answers, filledFields, onAnswer }) {
  switch (step.id) {
    case 'declaration': {
      const checked = Boolean(answers.self_employment_declaration) || Boolean(filledFields.self_employment_declaration && answers.self_employment_declaration === undefined);
      return (
        <Checkbox
          checked={answers.self_employment_declaration !== undefined
            ? Boolean(answers.self_employment_declaration)
            : Boolean(filledFields.self_employment_declaration)}
          onChange={() => onAnswer('self_employment_declaration', !checked)}
          label="I confirm I am self-employed."
          sublabel="This means you invoice us for the hours you work instead of being on our payroll. You are responsible for your own tax and National Insurance."
        />
      );
    }
    case 'terms': {
      return (
        <Checkbox
          checked={answers.terms_accepted !== undefined
            ? Boolean(answers.terms_accepted)
            : Boolean(filledFields.terms_accepted)}
          onChange={() => onAnswer('terms_accepted', !(answers.terms_accepted !== undefined ? answers.terms_accepted : filledFields.terms_accepted))}
          label="I agree to the terms of working with DOB Live."
          sublabel="This covers how shifts are allocated, how invoices are submitted, and what happens if a shift is cancelled. Your manager can show you the full terms."
        />
      );
    }
    case 'gdpr': {
      return (
        <Checkbox
          checked={answers.gdpr_consent !== undefined
            ? Boolean(answers.gdpr_consent)
            : Boolean(filledFields.gdpr_consent)}
          onChange={() => onAnswer('gdpr_consent', !(answers.gdpr_consent !== undefined ? answers.gdpr_consent : filledFields.gdpr_consent))}
          label="I agree to DOB Live holding my personal information."
          sublabel="We store your details to manage your work with us — shifts, pay, and your SIA licence. We do not sell your data and you can ask us to delete it at any time."
        />
      );
    }
    default:
      return null;
  }
}

// ── Review screen ──────────────────────────────────────────────────────────

function ReviewScreen({ steps, answers, filledFields, isCompany, onEdit, onBack, onSubmit, completing, completeError }) {
  // Helper: get display value for a field
  function displayVal(field) {
    const sessionVal = answers[field];
    if (sessionVal !== undefined && sessionVal !== '') {
      return SENSITIVE.has(field) ? maskValue(field, String(sessionVal)) : String(sessionVal);
    }
    if (filledFields[field]) {
      return SENSITIVE.has(field) ? '✓ Saved' : '✓ Saved';
    }
    return null;
  }

  function boolVal(field) {
    const v = answers[field] !== undefined ? answers[field] : filledFields[field];
    return v ? 'Yes, I confirm' : null;
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn} aria-label="Back">←</button>
        <span style={{ ...S.stepLabel }}>Review</span>
      </div>

      <div style={S.body}>
        <h1 style={{ ...S.title, marginBottom: 8 }}>Check your answers</h1>
        <p style={{ ...S.why, marginBottom: 28 }}>
          Have a look through and tap Change on anything that is wrong. Then tap Submit at the bottom.
        </p>

        {completeError && (
          <div style={{ ...S.errorBadge, marginBottom: 24 }}>{completeError}</div>
        )}

        <ReviewSection
          title="Home address"
          onEdit={onEdit}
          rows={[
            { label: 'Street', value: displayVal('address_line_1'), stepId: 'address' },
            { label: 'Line 2', value: displayVal('address_line_2') || '—' },
            { label: 'Town or city', value: displayVal('city') },
            { label: 'Postcode', value: displayVal('postcode') },
          ]}
        />

        <ReviewSection
          title="Personal details"
          onEdit={onEdit}
          rows={[
            { label: 'Date of birth', value: displayVal('date_of_birth'), stepId: 'dob' },
            { label: 'National Insurance number', value: displayVal('ni_number'), stepId: 'ni' },
            { label: 'Personal email', value: displayVal('personal_email'), stepId: 'email' },
            { label: 'Nationality', value: displayVal('nationality'), stepId: 'nationality' },
          ]}
        />

        <ReviewSection
          title="Emergency contact"
          onEdit={onEdit}
          rows={[
            { label: 'Name', value: displayVal('nok_name'), stepId: 'emergency' },
            { label: 'Relationship', value: displayVal('nok_relationship') || '—' },
            { label: 'Phone', value: displayVal('nok_phone') },
          ]}
        />

        <ReviewSection
          title="Bank details"
          onEdit={onEdit}
          rows={[
            { label: 'Bank', value: displayVal('bank_name') || '—' },
            { label: 'Account holder', value: displayVal('bank_account_holder'), stepId: 'bank' },
            { label: 'Sort code', value: displayVal('bank_sort_code') },
            { label: 'Account number', value: displayVal('bank_account_number') },
            { label: 'UTR number', value: displayVal('utr_number'), stepId: 'utr' },
          ]}
        />

        {isCompany && (
          <ReviewSection
            title="Company"
            onEdit={onEdit}
            rows={[
              { label: 'Company name', value: displayVal('company_name'), stepId: 'company' },
              { label: 'Company address', value: displayVal('company_address') || '—' },
              { label: 'Registration number', value: displayVal('company_reg_number') || '—' },
              { label: 'VAT number', value: displayVal('company_vat_number') || '—' },
            ]}
          />
        )}

        <ReviewSection
          title="Agreements"
          onEdit={onEdit}
          rows={[
            { label: 'Self-employed declaration', value: boolVal('self_employment_declaration'), stepId: 'declaration' },
            { label: 'Terms agreed', value: boolVal('terms_accepted'), stepId: 'terms' },
            { label: 'Data consent', value: boolVal('gdpr_consent'), stepId: 'gdpr' },
          ]}
        />

        <div style={{ height: 120 }} />
      </div>

      <div style={S.footer}>
        <button
          onClick={onSubmit}
          disabled={completing}
          style={{
            ...S.continueBtn,
            ...(completing ? S.continueBtnDisabled : {}),
            background: completing ? '#9ca3af' : RED,
          }}
        >
          {completing ? 'Submitting…' : 'Submit →'}
        </button>
      </div>
    </div>
  );
}
