import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Code2,
  Loader2,
  Minus,
  Plus,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import samplePack from "../SUST_Preli_Sample_Cases.json";
import "./styles.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

const enums = samplePack?._meta?.allowed_enums || {};
const languageOptions = enums.language || ["en", "bn", "mixed"];
const channelOptions = enums.channel || ["in_app_chat", "call_center", "email", "merchant_portal", "field_agent"];
const userTypeOptions = enums.user_type || ["customer", "merchant", "agent", "unknown"];
const transactionTypeOptions = enums.transaction_type || ["transfer", "payment", "cash_in", "cash_out", "settlement", "refund"];
const transactionStatusOptions = enums.transaction_status || ["completed", "failed", "pending", "reversed"];

const emptyTransaction = () => ({
  transaction_id: "",
  timestamp: "",
  type: "transfer",
  amount: "",
  counterparty: "",
  status: "completed",
});

const emptyForm = {
  ticket_id: "",
  complaint: "",
  language: "en",
  channel: "in_app_chat",
  user_type: "customer",
  campaign_context: "",
  transaction_history: [emptyTransaction()],
};

function App() {
  const [form, setForm] = useState(emptyForm);
  const [selectedSample, setSelectedSample] = useState("");
  const [health, setHealth] = useState({ status: "checking", payload: null });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const sampleCases = samplePack?.cases || [];

  useEffect(() => {
    pingHealth();
  }, []);

  async function pingHealth() {
    setHealth({ status: "checking", payload: null });
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const payload = await response.json();
      setHealth(response.ok && payload?.status === "ok"
        ? { status: "online", payload }
        : { status: "offline", payload });
    } catch {
      setHealth({ status: "offline", payload: null });
    }
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateTransaction(index, name, value) {
    setForm((current) => ({
      ...current,
      transaction_history: current.transaction_history.map((txn, txnIndex) => (
        txnIndex === index ? { ...txn, [name]: value } : txn
      )),
    }));
  }

  function addTransaction() {
    setForm((current) => ({
      ...current,
      transaction_history: [...current.transaction_history, emptyTransaction()],
    }));
  }

  function removeTransaction(index) {
    setForm((current) => ({
      ...current,
      transaction_history: current.transaction_history.filter((_, txnIndex) => txnIndex !== index),
    }));
  }

  function loadSample(id) {
    setSelectedSample(id);
    const selected = sampleCases.find((sample) => sample.id === id);
    if (!selected) return;
    const input = selected.input;
    setForm({
      ticket_id: input.ticket_id || "",
      complaint: input.complaint || "",
      language: input.language || "en",
      channel: input.channel || "in_app_chat",
      user_type: input.user_type || "customer",
      campaign_context: input.campaign_context || "",
      transaction_history: (input.transaction_history || []).map((txn) => ({
        transaction_id: txn.transaction_id || "",
        timestamp: toLocalDatetime(txn.timestamp),
        type: txn.type || "transfer",
        amount: txn.amount ?? "",
        counterparty: txn.counterparty || "",
        status: txn.status || "completed",
      })),
    });
    setResult(null);
    setError(null);
    setShowRaw(false);
  }

  function buildPayload() {
    return {
      ticket_id: form.ticket_id.trim(),
      complaint: form.complaint.trim(),
      language: form.language,
      channel: form.channel,
      user_type: form.user_type,
      campaign_context: form.campaign_context.trim(),
      transaction_history: form.transaction_history
        .filter((txn) => txn.transaction_id || txn.timestamp || txn.amount || txn.counterparty)
        .map((txn) => ({
          transaction_id: txn.transaction_id.trim(),
          timestamp: fromLocalDatetime(txn.timestamp),
          type: txn.type,
          amount: Number(txn.amount),
          counterparty: txn.counterparty.trim(),
          status: txn.status,
        })),
    };
  }

  async function submitTicket(event) {
    event.preventDefault();
    setResult(null);
    setShowRaw(false);

    if (!form.ticket_id.trim() || !form.complaint.trim()) {
      setError({
        title: "Missing required fields",
        message: "ticket_id and complaint are required. Complaint cannot be empty.",
        tone: "validation",
      });
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(mapApiError(response.status, payload));
        return;
      }

      setResult(payload);
    } catch (requestError) {
      setError({
        title: requestError.name === "AbortError" ? "Investigation timed out" : "Backend unreachable",
        message: requestError.name === "AbortError"
          ? "The AI investigation exceeded 30 seconds. You can retry when the queue clears."
          : "The frontend could not reach the backend. Check that the Express service is running on port 8000.",
        tone: "network",
      });
    } finally {
      clearTimeout(timeout);
      setIsSubmitting(false);
    }
  }

  const matchedTransactionId = result?.relevant_transaction_id || null;

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
              <RadioTower size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">QueueStorm Investigator</h1>
              <p className="text-sm text-slate-500">Support copilot command desk</p>
            </div>
          </div>
          <HealthIndicator health={health} onRetry={pingHealth} />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-6">
        <section className="col-span-12 xl:col-span-5">
          <TicketForm
            form={form}
            sampleCases={sampleCases}
            selectedSample={selectedSample}
            isSubmitting={isSubmitting}
            onFieldChange={updateField}
            onTransactionChange={updateTransaction}
            onAddTransaction={addTransaction}
            onRemoveTransaction={removeTransaction}
            onLoadSample={loadSample}
            onSubmit={submitTicket}
          />
        </section>

        <section className="col-span-12 xl:col-span-7">
          {isSubmitting && <InvestigatingPanel />}
          {error && <ErrorPanel error={error} onRetry={submitTicket} />}
          {!isSubmitting && !error && !result && <EmptyState />}
          {result && !isSubmitting && (
            <ResultView
              result={result}
              transactions={form.transaction_history}
              matchedTransactionId={matchedTransactionId}
              showRaw={showRaw}
              onToggleRaw={() => setShowRaw((value) => !value)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function TicketForm({
  form,
  sampleCases,
  selectedSample,
  isSubmitting,
  onFieldChange,
  onTransactionChange,
  onAddTransaction,
  onRemoveTransaction,
  onLoadSample,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Ticket Input</p>
          <h2 className="mt-1 text-2xl font-semibold">Investigate a complaint</h2>
        </div>
        <Sparkles className="mt-1 text-cyan-700" size={22} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Load sample case" className="col-span-2">
          <select value={selectedSample} onChange={(event) => onLoadSample(event.target.value)} className="input">
            <option value="">Select a worked case</option>
            {sampleCases.map((sample) => (
              <option key={sample.id} value={sample.id}>{sample.id} - {sample.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Ticket ID">
          <input className="input" value={form.ticket_id} onChange={(event) => onFieldChange("ticket_id", event.target.value)} placeholder="TKT-001" />
        </Field>

        <Field label="Language">
          <Select value={form.language} options={languageOptions} onChange={(value) => onFieldChange("language", value)} />
        </Field>

        <Field label="Channel">
          <Select value={form.channel} options={channelOptions} onChange={(value) => onFieldChange("channel", value)} />
        </Field>

        <Field label="User Type">
          <Select value={form.user_type} options={userTypeOptions} onChange={(value) => onFieldChange("user_type", value)} />
        </Field>

        <Field label="Campaign Context" className="col-span-2">
          <input className="input" value={form.campaign_context} onChange={(event) => onFieldChange("campaign_context", event.target.value)} placeholder="boishakh_bonanza_day_1" />
        </Field>

        <Field label="Complaint" className="col-span-2">
          <textarea className="input min-h-32 resize-y" value={form.complaint} onChange={(event) => onFieldChange("complaint", event.target.value)} placeholder="Customer complaint text" />
        </Field>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Transaction History</h3>
          <button type="button" onClick={onAddTransaction} className="icon-button text-cyan-800" title="Add transaction">
            <Plus size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {form.transaction_history.map((txn, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Transaction {index + 1}</span>
                <button type="button" onClick={() => onRemoveTransaction(index)} className="icon-button text-rose-700" title="Remove transaction" disabled={form.transaction_history.length === 1}>
                  <Minus size={18} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="input" value={txn.transaction_id} onChange={(event) => onTransactionChange(index, "transaction_id", event.target.value)} placeholder="TXN-9101" />
                <input className="input" type="datetime-local" value={txn.timestamp} onChange={(event) => onTransactionChange(index, "timestamp", event.target.value)} />
                <Select value={txn.type} options={transactionTypeOptions} onChange={(value) => onTransactionChange(index, "type", value)} />
                <input className="input" type="number" min="0" step="0.01" value={txn.amount} onChange={(event) => onTransactionChange(index, "amount", event.target.value)} placeholder="Amount" />
                <input className="input" value={txn.counterparty} onChange={(event) => onTransactionChange(index, "counterparty", event.target.value)} placeholder="Counterparty" />
                <Select value={txn.status} options={transactionStatusOptions} onChange={(value) => onTransactionChange(index, "status", value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldAlert size={18} />}
        {isSubmitting ? "AI is investigating..." : "Analyze ticket"}
      </button>
    </form>
  );
}

function ResultView({ result, transactions, matchedTransactionId, showRaw, onToggleRaw }) {
  const verdict = verdictConfig[result.evidence_verdict] || verdictConfig.insufficient_data;
  const VerdictIcon = verdict.icon;
  const confidence = typeof result.confidence === "number" ? Math.round(result.confidence * 100) : null;
  const visibleReasonCodes = getVisibleReasonCodes(result.reason_codes);

  return (
    <div className="space-y-5">
      <div className={`rounded-lg border p-5 shadow-panel ${verdict.panel}`}>
        <div className="flex items-start justify-between gap-5">
          <div className="flex gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-md ${verdict.iconBox}`}>
              <VerdictIcon size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence Verdict</p>
              <h2 className="mt-1 text-3xl font-semibold capitalize">{formatLabel(result.evidence_verdict)}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{result.agent_summary}</p>
            </div>
          </div>
          <SeverityBadge severity={result.severity} />
        </div>

        {result.human_review_required && (
          <div className="mt-5 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
            <AlertTriangle size={18} />
            <span className="font-semibold">Requires human review</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Agent Action</h3>
          <p className="mt-3 text-base leading-7 text-slate-800">{result.recommended_next_action}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip label={formatLabel(result.case_type)} tone="cyan" />
            <Chip label={formatLabel(result.department)} tone="violet" />
            {visibleReasonCodes.map((code) => <Chip key={code} label={formatLabel(code)} tone="slate" />)}
          </div>
          {confidence !== null && (
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm font-medium text-slate-600">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${confidence}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Customer Reply Draft</h3>
          <div className="mt-4 rounded-lg rounded-tl-sm border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-950">
            {result.customer_reply}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Transaction Timeline</h3>
            {!matchedTransactionId && <p className="mt-1 text-sm text-amber-700">No matching transaction found.</p>}
          </div>
          {matchedTransactionId && <Chip label={`Matched ${matchedTransactionId}`} tone="emerald" />}
        </div>
        <div className="space-y-3">
          {transactions.length === 0 && <p className="text-sm text-slate-500">No transactions were provided.</p>}
          {transactions.map((txn, index) => {
            const isMatched = txn.transaction_id === matchedTransactionId;
            return (
              <div key={`${txn.transaction_id}-${index}`} className={`rounded-lg border p-4 ${isMatched ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{txn.transaction_id || "Untitled transaction"}</p>
                      {isMatched && <span className="rounded-sm bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">MATCHED</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{fromLocalDatetime(txn.timestamp) || "No timestamp"}</p>
                  </div>
                  <p className="text-lg font-semibold">{txn.amount ? `${txn.amount} BDT` : "No amount"}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Chip label={formatLabel(txn.type)} tone="slate" />
                  <Chip label={formatLabel(txn.status)} tone="cyan" />
                  <Chip label={txn.counterparty || "No counterparty"} tone="violet" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-panel">
        <button type="button" onClick={onToggleRaw} className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold">
          <span className="flex items-center gap-2"><Code2 size={18} /> Raw JSON</span>
          <span className="text-sm text-slate-500">{showRaw ? "Hide" : "Show"}</span>
        </button>
        {showRaw && <pre className="overflow-auto border-t border-slate-200 bg-slate-950 p-5 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>}
      </div>
    </div>
  );
}

function HealthIndicator({ health, onRetry }) {
  const online = health.status === "online";
  const checking = health.status === "checking";
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${online ? "border-emerald-200 bg-emerald-50 text-emerald-800" : checking ? "border-slate-200 bg-slate-50 text-slate-600" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : checking ? "bg-slate-400" : "bg-rose-500"}`} />
      Backend {checking ? "checking" : online ? "online" : "offline"}
      <button type="button" className="ml-1" onClick={onRetry} title="Refresh health">
        <RefreshCcw size={14} />
      </button>
    </div>
  );
}

function InvestigatingPanel() {
  return (
    <div className="rounded-lg border border-cyan-200 bg-white p-8 text-center shadow-panel">
      <Loader2 className="mx-auto animate-spin text-cyan-700" size={34} />
      <h2 className="mt-4 text-2xl font-semibold">AI is investigating...</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Matching the complaint against transaction evidence, routing rules, severity, and safe response policy.</p>
      <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-600" />
      </div>
    </div>
  );
}

function ErrorPanel({ error, onRetry }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-white p-6 shadow-panel">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-rose-100 text-rose-700">
          <XCircle size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{error.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error.message}</p>
          <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
            <RefreshCcw size={16} /> Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[560px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <div>
        <Clock3 className="mx-auto text-slate-400" size={34} />
        <h2 className="mt-4 text-2xl font-semibold">Awaiting ticket</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Submit a complaint to see the evidence verdict, matched transaction, recommended action, and customer reply draft.</p>
      </div>
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, options, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="input">
      {options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
    </select>
  );
}

function SeverityBadge({ severity }) {
  const classes = {
    low: "bg-slate-100 text-slate-700 border-slate-200",
    medium: "bg-blue-100 text-blue-800 border-blue-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    critical: "bg-rose-700 text-white border-rose-800 shadow-lg shadow-rose-200",
  };
  return <span className={`rounded-md border px-3 py-1.5 text-sm font-bold uppercase tracking-[0.14em] ${classes[severity] || classes.low}`}>{severity}</span>;
}

function Chip({ label, tone }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
    violet: "bg-violet-50 text-violet-800 border-violet-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{label}</span>;
}

function mapApiError(status, payload) {
  if (status === 400) {
    return { title: "Bad input", message: payload?.error || "The backend rejected the request shape.", tone: "validation" };
  }
  if (status === 422) {
    return { title: "Empty complaint", message: payload?.error || "Complaint must not be empty.", tone: "validation" };
  }
  if (status === 500) {
    return { title: "Server error", message: payload?.error || "The backend returned an internal server error.", tone: "server" };
  }
  return { title: `Request failed (${status})`, message: payload?.error || "The backend returned an unexpected error.", tone: "server" };
}

function getVisibleReasonCodes(reasonCodes = []) {
  const internalCodes = new Set([
    "ai_error",
    "fallback",
    "local_investigation",
    "manual_review",
    "missing_api_key",
  ]);

  return reasonCodes.filter((code) => !internalCodes.has(code));
}

function formatLabel(value) {
  return String(value || "").replace(/_/g, " ");
}

function toLocalDatetime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function fromLocalDatetime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

const verdictConfig = {
  consistent: {
    icon: CheckCircle2,
    panel: "border-emerald-200 bg-emerald-50",
    iconBox: "bg-emerald-600 text-white",
  },
  inconsistent: {
    icon: XCircle,
    panel: "border-rose-200 bg-rose-50",
    iconBox: "bg-rose-700 text-white",
  },
  insufficient_data: {
    icon: CircleHelp,
    panel: "border-amber-200 bg-amber-50",
    iconBox: "bg-amber-500 text-white",
  },
};

createRoot(document.getElementById("root")).render(<App />);
