import { useRef, useState } from 'react';
import { FileSearch, Loader2, Upload, Copy, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { Panel } from './StudioTools';
import { lakh, rupees } from '../utils/loan';

/*
 * Check a contractor's quote: paste it (copied from the PDF, WhatsApp or email) or open a .txt / .csv,
 * and the server lines it up against this house's estimate, trade by trade, checks material rates and
 * quantities, and lists what it leaves out. The questions to ask can be copied and sent to the contractor.
 */
const EXAMPLE = `QUOTATION - Residential building G+1
1. Earthwork excavation for foundation - Rs 45,000
2. PCC and footings, plinth beam = 3,20,000
3. RCC columns, beams and slabs (M20) incl. shuttering - 9.5 L
4. Steel TMT Fe500: 8.2 tonnes @ Rs 78,000 per ton = 6,39,600
5. Cement 650 bags @ 470/bag = 3,05,500
6. Brickwork 9" and 4.5" walls - Rs 3,10,000
7. Plastering inside and outside: 1,05,000
8. Flooring: vitrified tiles 2200 sqft @ Rs 95 per sqft = 2,09,000
9. Electrical wiring and switches - 1.1 lakh
10. Painting (interior and exterior emulsion) 1,20,000
11. Doors and windows (sal wood frames, flush doors, aluminium windows) 3,40,000
Grand Total: Rs 34,20,000`;

const STATUS = {
  ok: ['In line', 'text-emerald-300 bg-emerald-500/10'],
  high: ['High', 'text-rose-200 bg-rose-500/15'],
  low: ['Low', 'text-amber-200 bg-amber-500/15'],
  missing: ['Missing', 'text-amber-200 bg-amber-500/15'],
  covered: ['Included', 'text-emerald-300 bg-emerald-500/10'],
  unclear: ['Not listed', 'text-amber-200 bg-amber-500/15'],
};
const Chip = ({ s }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS[s]?.[1] || ''}`}>{STATUS[s]?.[0] || s}</span>;

export default function QuoteCheck({ elements, projectId, apiUrl, onClose }) {
  const key = `quote_${projectId || 'draft'}`;
  const [text, setText] = useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [r, setR] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const keep = (t) => { setText(t); try { localStorage.setItem(key, t); } catch { /* private mode */ } };
  const open = (file) => {
    if (!file) return;
    if (!/\.(txt|csv|tsv|md)$/i.test(file.name) && !/^text\//.test(file.type)) {
      setError("Open a text or CSV file. For a PDF or a photo, copy the quote's text and paste it here.");
      return;
    }
    file.text().then(t => keep(t.slice(0, 20000)));
  };

  const check = async () => {
    setBusy(true); setError(''); setR(null);
    try {
      const res = await fetch(`${apiUrl}/api/ai/check-quote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, elements }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof d.detail === 'string' ? d.detail : `The server answered ${res.status}.`);
      setR(d);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  // the questions to send the contractor
  const questions = r ? [
    ...r.trades.filter(t => ['high', 'missing', 'unclear', 'low'].includes(t.status)).map(t =>
      t.status === 'high' ? `${t.name}: you quote ${rupees(t.quote)}; I expected about ${rupees(t.estimate)}. Can you share the quantities and rates behind it?`
        : t.status === 'low' ? `${t.name}: ${rupees(t.quote)} looks low. Which materials and grades does it assume?`
          : `${t.name}: is it included in the quote? If not, what would it cost?`),
    ...r.rates.filter(x => x.status !== 'ok').map(x => `${x.item} at ${rupees(x.quote)} a ${x.unit}${x.status === 'high' ? ' is above the usual rate. Can it come down?' : ': which brand and grade?'}`),
    ...r.extras.map(x => `Is ${x} included?`),
  ] : [];
  const copy = () => {
    navigator.clipboard?.writeText(`Questions about the quote:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  const verdict = r && (r.overall === 'high' ? ['Above the estimate', 'border-rose-400/40 bg-rose-500/10 text-rose-100']
    : r.overall === 'low' ? ['Below the estimate', 'border-amber-400/40 bg-amber-500/10 text-amber-100']
      : ['Close to the estimate', 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100']);

  return (
    <Panel icon={FileSearch} title="Check a contractor's quote" onClose={onClose} wide>
      <p className="text-[11px] leading-snug text-zinc-500">
        Paste the quote: copy it from the PDF, WhatsApp or email, one item per line with its amount. Each trade is compared with
        this house's estimate, material rates with market rates, and anything usually left out is listed.
      </p>
      <textarea value={text} onChange={(e) => keep(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={7} maxLength={20000}
        placeholder={'e.g.\nRCC columns, beams and slabs - 9.5 L\nSteel TMT 8.2 tonnes @ Rs 78,000 per ton\nBrickwork - Rs 3,10,000\n…\nGrand total: Rs 34,20,000\n\nor a package: Rs 1,950 per sq ft, including …'}
        className="mt-2 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[11px] text-white focus:border-indigo-500 focus:outline-none" />
      <input ref={fileRef} type="file" accept=".txt,.csv,.tsv,.md,text/*" className="hidden" onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={check} disabled={busy || text.trim().length < 3} className="btn-primary px-4 py-1.5 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />} Check the quote
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn-secondary px-3 py-1.5 text-xs"><Upload className="h-3.5 w-3.5" /> Open a text file</button>
        {!text && <button onClick={() => keep(EXAMPLE)} className="text-[11px] text-indigo-300 hover:text-indigo-200">Try an example</button>}
      </div>
      {error && <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</p>}

      {r && (
        <div className="mt-4 space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${verdict[1]}`}>
            <p className="text-sm font-semibold">{verdict[0]}{r.diff ? ` by ${Math.abs(Math.round(r.diff * 100))} %` : ''}</p>
            <p className="mt-1 text-xs opacity-90">
              Quote {lakh(r.total)} ({r.basis}) against an estimate of {lakh(r.estimate)}, which includes 12 % for the contractor's overheads and profit{r.gst ? ' and 18 % GST' : ''}.
              {r.per_sqft ? ` That's ${rupees(r.per_sqft)} per sq ft of built-up area against ${rupees(r.est_per_sqft)} (${r.built_sqft.toLocaleString('en-IN')} sq ft).` : ''}
            </p>
            {r.notes.filter(n => !/^The quote is/.test(n)).map((n, i) => <p key={i} className="mt-1.5 text-xs opacity-90">{n}</p>)}
          </div>

          <div>
            <p className="label-caps mb-1.5">By trade</p>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] text-zinc-500"><th className="py-1 font-normal">Trade</th><th className="font-normal">Quote</th><th className="font-normal">Estimate</th><th className="font-normal" /><th className="font-normal">Note</th></tr></thead>
              <tbody>
                {r.trades.map(t => (
                  <tr key={t.key} className="border-t border-zinc-800/70 align-top">
                    <td className="py-1.5 pr-2 text-zinc-200">{t.name}</td>
                    <td className="pr-2 text-zinc-300">{t.quote != null ? lakh(t.quote) : '—'}</td>
                    <td className="pr-2 text-zinc-500">{lakh(t.estimate)}</td>
                    <td className="pr-2"><Chip s={t.status} /></td>
                    <td className="text-[11px] text-zinc-400">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {r.rates.length > 0 && (
            <div>
              <p className="label-caps mb-1.5">Material rates</p>
              <ul className="space-y-1">
                {r.rates.map(x => (
                  <li key={x.item} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs">
                    <span className="text-zinc-200">{x.item}</span>
                    <span className="text-zinc-400">{rupees(x.quote)} a {x.unit} <span className="text-zinc-600">· usual {rupees(x.market)}</span></span>
                    <Chip s={x.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.extras.length > 0 && (
            <div>
              <p className="label-caps mb-1.5">Not mentioned (often extra later)</p>
              <div className="flex flex-wrap gap-1.5">
                {r.extras.map(x => <span key={x} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">{x}</span>)}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              {r.source === 'ai' && <Sparkles className="h-3 w-3 text-indigo-300" />}
              Read {r.lines.length} priced line{r.lines.length === 1 ? '' : 's'}{r.source === 'ai' ? ' with AI' : ''}. Estimates use typical rates; a quote that differs isn't wrong, just worth asking about.
            </p>
            {questions.length > 0 && (
              <button onClick={copy} className="btn-secondary px-3 py-1.5 text-xs">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : `Copy ${questions.length} questions for the contractor`}
              </button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
