import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  RefreshCw,
  X,
  ShieldCheck,
  CheckCircle,
  Copy,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Dialog, Button, Badge } from './ui';

interface ContractNoteTrade {
  orderId: string;
  tradeId: string;
  tradeTime: string;
  symbol: string;
  instrumentToken: string;
  exchange: string;
  orderType: string;
  productType: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  rate: number;
  grossAmount: number;
  brokerageRate: number;
  brokerageTotal: number;
  netRate: number;
  netAmount: number;
}

interface ContractNoteFinancials {
  buyTurnover: number;
  sellTurnover: number;
  totalTurnover: number;
  brokerage: number;
  exchangeTxnCharge: number;
  sttCtt: number;
  sebiTurnoverFee: number;
  stampDuty: number;
  gst: number;
  totalTaxesAndCharges: number;
  netObligation: number;
  payType: 'PAY_OUT_TO_CLIENT' | 'PAY_IN_BY_CLIENT';
}

interface ContractNoteData {
  contractNoteNo: string;
  tradeDate: string;
  settlementDate: string;
  settlementNo: string;
  broker: {
    name: string;
    tagline: string;
    sebiRegNo: string;
    cin: string;
    nseMemberCode: string;
    bseMemberCode: string;
    address: string;
    email: string;
    website: string;
  };
  client: {
    clientCode: string;
    name: string;
    email: string;
    pan: string;
    address: string;
  };
  trades: ContractNoteTrade[];
  financials: ContractNoteFinancials;
}

interface ContractNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  defaultDate?: string;
}

export const ContractNoteModal: React.FC<ContractNoteModalProps> = ({
  isOpen,
  onClose,
  token,
  defaultDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    defaultDate || new Date().toISOString().slice(0, 10)
  );
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractNote, setContractNote] = useState<ContractNoteData | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch available trade dates
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/v1/portfolio/contract-notes/dates', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.dates) && data.dates.length > 0) {
          setAvailableDates(data.dates);
          if (!defaultDate && !data.dates.includes(selectedDate)) {
            setSelectedDate(data.dates[0]);
          }
        }
      })
      .catch((err) => console.error('Failed to load contract note dates:', err));
  }, [isOpen, token, defaultDate]);

  // Fetch contract note for selected date
  const fetchContractNote = (dateToFetch: string) => {
    setLoading(true);
    setError(null);

    fetch(`/api/v1/portfolio/contract-notes?date=${dateToFetch}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setContractNote(data.contractNote);
        } else {
          setError(data.error?.message || 'Failed to load contract note');
          setContractNote(null);
        }
      })
      .catch((err) => {
        setError(err.message || 'Network error fetching contract note');
        setContractNote(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchContractNote(selectedDate);
    }
  }, [isOpen, selectedDate]);

  const handleCopyNoteNo = () => {
    if (!contractNote?.contractNoteNo) return;
    navigator.clipboard.writeText(contractNote.contractNoteNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!contractNote || contractNote.trades.length === 0) return;

    const headers = [
      'Order ID',
      'Trade ID',
      'Time (IST)',
      'Security / Symbol',
      'Segment',
      'Order Type',
      'Product',
      'Buy / Sell',
      'Quantity',
      'Gross Rate (₹)',
      'Brokerage (₹)',
      'Net Rate (₹)',
      'Gross Amount (₹)',
    ];

    const rows = contractNote.trades.map((t) => [
      t.orderId,
      t.tradeId,
      t.tradeTime,
      `"${t.symbol}"`,
      t.exchange,
      t.orderType,
      t.productType,
      t.side,
      t.quantity,
      t.rate.toFixed(2),
      '0.00',
      t.netRate.toFixed(2),
      t.grossAmount.toFixed(2),
    ]);

    // Financial summaries
    rows.push([]);
    rows.push(['Financial Summary & Levies', 'Amount (₹)']);
    rows.push(['Total Buy Turnover', contractNote.financials.buyTurnover.toFixed(2)]);
    rows.push(['Total Sell Turnover', contractNote.financials.sellTurnover.toFixed(2)]);
    rows.push(['Total Turnover', contractNote.financials.totalTurnover.toFixed(2)]);
    rows.push(['TradeGrow Brokerage', '0.00 (Zero Brokerage)']);
    rows.push(['Exchange Transaction Charges', contractNote.financials.exchangeTxnCharge.toFixed(2)]);
    rows.push(['Securities Transaction Tax (STT)', contractNote.financials.sttCtt.toFixed(2)]);
    rows.push(['SEBI Turnover Charges', contractNote.financials.sebiTurnoverFee.toFixed(2)]);
    rows.push(['Stamp Duty', contractNote.financials.stampDuty.toFixed(2)]);
    rows.push(['GST (18%)', contractNote.financials.gst.toFixed(2)]);
    rows.push(['Total Statutory Levies', contractNote.financials.totalTaxesAndCharges.toFixed(2)]);
    rows.push(['Net Obligation (' + contractNote.financials.payType + ')', contractNote.financials.netObligation.toFixed(2)]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TradeGrow_Contract_Note_${contractNote.contractNoteNo}_${selectedDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[var(--text-main)]">
          <FileText className="w-5 h-5 text-emerald-400" />
          <span>Electronic Contract Note (ECN) cum Tax Invoice</span>
          <Badge variant="gain" className="ml-2 font-mono text-[10px]">
            SEBI Form A/B
          </Badge>
        </div>
      }
    >
      <div className="space-y-4 print:space-y-2">
        {/* Style block for printing */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-contract-note, #printable-contract-note * {
              visibility: visible;
            }
            #printable-contract-note {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: #ffffff !important;
              color: #000000 !important;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print-border {
              border-color: #000000 !important;
            }
            .print-text-black {
              color: #000000 !important;
            }
            .print-bg-gray {
              background-color: #f3f4f6 !important;
            }
          }
        `}</style>

        {/* Action Controls & Date Bar (Hidden in Print) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--bg-surface-elevated)]/60 rounded-xl border border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Trade Date:
            </span>

            {availableDates.length > 0 && (
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-xs font-bold text-[var(--text-main)] cursor-pointer focus:outline-none focus:border-emerald-500"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-2 py-1 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            />

            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchContractNote(selectedDate)}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={!contractNote || contractNote.trades.length === 0}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={!contractNote || contractNote.trades.length === 0}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Printable Contract Note Document */}
        <div
          id="printable-contract-note"
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 sm:p-6 text-xs text-[var(--text-main)] space-y-4 print:text-black print:bg-white print:border-black print:space-y-3"
        >
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-400 animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">
                Compiling electronic contract note from exchange trade records...
              </p>
            </div>
          ) : !contractNote || contractNote.trades.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <FileText className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-50" />
              <h4 className="font-bold text-sm text-[var(--text-main)]">
                No Executed Trades on {selectedDate}
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                No orders were filled on this date. Select another trading day from the dropdown to
                view and download your contract note.
              </p>
            </div>
          ) : (
            <>
              {/* Header: Broker Details & Form A/B Notice */}
              <div className="border-b border-[var(--border-color)] print:border-black pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base sm:text-lg text-emerald-400 print:text-black tracking-tight">
                      TRADEGROW
                    </span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:border-black print:text-black">
                      ZERO BROKERAGE
                    </span>
                  </div>
                  <p className="font-bold text-xs sm:text-sm text-[var(--text-main)] print:text-black">
                    {contractNote.broker.name}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] print:text-gray-700">
                    {contractNote.broker.address}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] print:text-gray-700">
                    CIN: <span className="font-mono">{contractNote.broker.cin}</span> | SEBI Reg No:{' '}
                    <span className="font-mono font-bold">{contractNote.broker.sebiRegNo}</span>
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] print:text-gray-700">
                    NSE Member Code: <span className="font-mono">{contractNote.broker.nseMemberCode}</span> |
                    BSE Member Code: <span className="font-mono">{contractNote.broker.bseMemberCode}</span>
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1 sm:max-w-xs">
                  <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[var(--text-main)] print:text-black">
                    Contract Note Cum Tax Invoice
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)] print:text-gray-700">
                    (Issued under SEBI Stock Brokers Regulations, 1992)
                  </p>
                  <div className="flex sm:justify-end items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-mono font-bold text-emerald-400 print:text-black">
                      {contractNote.contractNoteNo}
                    </span>
                    <button
                      onClick={handleCopyNoteNo}
                      className="print:hidden text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
                      title="Copy Contract Note Number"
                    >
                      {copied ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Metadata & Client Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[var(--bg-surface-elevated)]/40 print:bg-gray-100 p-3 rounded-xl border border-[var(--border-color)] print:border-black text-[11px]">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-600 block">
                    Trade Date:
                  </span>
                  <span className="font-bold font-mono text-[var(--text-main)] print:text-black">
                    {contractNote.tradeDate}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-600 block">
                    Settlement Date:
                  </span>
                  <span className="font-bold font-mono text-[var(--text-main)] print:text-black">
                    {contractNote.settlementDate} (T+1)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-600 block">
                    Client UCC / Code:
                  </span>
                  <span className="font-bold font-mono text-[var(--text-main)] print:text-black">
                    {contractNote.client.clientCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-600 block">
                    Client PAN:
                  </span>
                  <span className="font-bold font-mono text-[var(--text-main)] print:text-black">
                    {contractNote.client.pan}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-600 block">
                    Client Name:
                  </span>
                  <span className="font-bold text-[var(--text-main)] print:text-black">
                    {contractNote.client.name}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-600 block">
                    Registered Email:
                  </span>
                  <span className="font-mono text-[var(--text-main)] print:text-black">
                    {contractNote.client.email}
                  </span>
                </div>
              </div>

              {/* Trades Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] print:text-black">
                    Section A: Executed Trades ({contractNote.trades.length})
                  </h4>
                  <span className="text-[10px] text-emerald-400 print:text-black font-semibold">
                    100% Zero Brokerage Applied
                  </span>
                </div>

                <div className="overflow-x-auto border border-[var(--border-color)] print:border-black rounded-xl">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-surface-elevated)] print:bg-gray-200 border-b border-[var(--border-color)] print:border-black text-[10px] uppercase font-bold text-[var(--text-muted)] print:text-black">
                        <th className="p-2">Order / Trade ID</th>
                        <th className="p-2">Time</th>
                        <th className="p-2">Security Description</th>
                        <th className="p-2">Seg</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">B / S</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Gross Rate</th>
                        <th className="p-2 text-right text-emerald-400 print:text-black">Brokerage</th>
                        <th className="p-2 text-right">Net Rate</th>
                        <th className="p-2 text-right">Net Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] print:divide-black">
                      {contractNote.trades.map((t, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-[var(--bg-surface-elevated)]/30 print:hover:bg-transparent"
                        >
                          <td className="p-2 font-mono text-[10px]">
                            <span className="block font-bold">{t.orderId}</span>
                            <span className="text-[var(--text-muted)] print:text-gray-600">
                              {t.tradeId}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-[10px]">{t.tradeTime}</td>
                          <td className="p-2 font-bold font-mono">
                            {t.symbol}
                            <span className="block text-[9px] font-normal text-[var(--text-muted)] print:text-gray-600">
                              {t.productType}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-[10px]">{t.exchange}</td>
                          <td className="p-2 text-[10px]">{t.orderType}</td>
                          <td className="p-2 font-black">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                t.side === 'BUY'
                                  ? 'bg-blue-500/10 text-blue-400 print:text-blue-700'
                                  : 'bg-rose-500/10 text-rose-400 print:text-rose-700'
                              }`}
                            >
                              {t.side}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-bold">{t.quantity}</td>
                          <td className="p-2 text-right font-mono">₹{t.rate.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-400 print:text-black">
                            ₹0.00
                          </td>
                          <td className="p-2 text-right font-mono">₹{t.netRate.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            ₹{t.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--bg-surface-elevated)]/80 print:bg-gray-100 border-t border-[var(--border-color)] print:border-black font-bold">
                        <td colSpan={6} className="p-2 text-right uppercase text-[10px]">
                          Total Turnover:
                        </td>
                        <td className="p-2 text-right font-mono">
                          {contractNote.trades.reduce((acc, curr) => acc + curr.quantity, 0)}
                        </td>
                        <td colSpan={2} className="p-2 text-right font-mono text-emerald-400 print:text-black">
                          ₹0.00 Brokerage
                        </td>
                        <td className="p-2 text-right uppercase text-[10px]">Turnover:</td>
                        <td className="p-2 text-right font-mono text-sm">
                          ₹
                          {contractNote.financials.totalTurnover.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Section B: Financial Summary & Statutory Charges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Turnover & Brokerage Policy */}
                <div className="p-3.5 rounded-xl border border-[var(--border-color)] print:border-black bg-[var(--bg-surface-elevated)]/20 print:bg-transparent space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] print:text-black">
                    Section B: Turnover &amp; Brokerage
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">Gross Buy Turnover:</span>
                      <span className="font-mono font-bold">
                        ₹{contractNote.financials.buyTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">Gross Sell Turnover:</span>
                      <span className="font-mono font-bold">
                        ₹{contractNote.financials.sellTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[var(--border-color)] print:border-black">
                      <span className="font-bold">Total Gross Turnover:</span>
                      <span className="font-mono font-black text-sm">
                        ₹{contractNote.financials.totalTurnover.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 print:border-black">
                      <div>
                        <span className="font-bold text-emerald-400 print:text-black block">
                          TradeGrow Brokerage Charged:
                        </span>
                        <span className="text-[10px] text-emerald-500/80 print:text-gray-700">
                          100% Zero Brokerage for all Derivatives &amp; Equities
                        </span>
                      </div>
                      <span className="font-black font-mono text-emerald-400 print:text-black text-base">
                        ₹0.00
                      </span>
                    </div>
                  </div>
                </div>

                {/* Statutory Levies Breakdown & Net Obligation */}
                <div className="p-3.5 rounded-xl border border-[var(--border-color)] print:border-black bg-[var(--bg-surface-elevated)]/20 print:bg-transparent space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] print:text-black">
                    Section C: Statutory Levies &amp; Net Obligation
                  </h4>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">Exchange Transaction Charges:</span>
                      <span className="font-mono">₹{contractNote.financials.exchangeTxnCharge.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">Securities Transaction Tax (STT / CTT):</span>
                      <span className="font-mono">₹{contractNote.financials.sttCtt.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">SEBI Turnover Charges (₹10/crore):</span>
                      <span className="font-mono">₹{contractNote.financials.sebiTurnoverFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">Stamp Duty:</span>
                      <span className="font-mono">₹{contractNote.financials.stampDuty.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] print:text-gray-700">GST @ 18% (CGST 9% + SGST 9%):</span>
                      <span className="font-mono">₹{contractNote.financials.gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[var(--border-color)] print:border-black text-[var(--text-muted)] print:text-gray-700">
                      <span>Total Statutory Levies:</span>
                      <span className="font-mono font-bold text-[var(--text-main)] print:text-black">
                        ₹{contractNote.financials.totalTaxesAndCharges.toFixed(2)}
                      </span>
                    </div>

                    {/* Net Pay-in / Pay-out Obligation Pill */}
                    <div
                      className={`flex justify-between items-center p-2.5 rounded-lg border font-bold ${
                        contractNote.financials.payType === 'PAY_OUT_TO_CLIENT'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 print:text-black'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400 print:text-black'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] uppercase tracking-wider block opacity-90">
                          {contractNote.financials.payType === 'PAY_OUT_TO_CLIENT'
                            ? 'Net Pay-Out to Client (Credit):'
                            : 'Net Pay-In by Client (Debit):'}
                        </span>
                        <span className="text-[9px] opacity-75">
                          Settlement Cycle: {contractNote.settlementDate}
                        </span>
                      </div>
                      <span className="text-base sm:text-lg font-black font-mono">
                        ₹
                        {Math.abs(contractNote.financials.netObligation).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statutory Disclaimer & Sign-off */}
              <div className="pt-2 border-t border-[var(--border-color)] print:border-black text-[10px] text-[var(--text-muted)] print:text-gray-600 space-y-1">
                <p>
                  <strong>Statutory Declaration:</strong> This electronic contract note is issued subject
                  to the Rules, Bye-laws, and Business Rules of the National Stock Exchange of India
                  (NSE) and BSE Limited. It is a system-generated document and requires no physical
                  signature.
                </p>
                <p>
                  TradeGrow Securities Private Limited operates under a strict Zero-Brokerage model for all
                  retail and institutional clients. No commission or execution markup is levied on any order.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
