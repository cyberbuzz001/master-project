import React, { useEffect, useRef, useState } from 'react';
import { OptionChainItem, MarketTick } from '../types';
import { ArrowRight, ArrowLeft, TrendingUp } from 'lucide-react';
import { SelectedOptionContract } from './OptionStrikeChartModal';

interface OptionChainRowProps {
  row: OptionChainItem;
  isAtm: boolean;
  spotPrice: number;
  viewMode: 'LTP_OI' | 'GREEKS' | 'VOLUME';
  ceTick?: MarketTick;
  peTick?: MarketTick;
  activeLtpKey: string | null;
  onSelectLtp: (key: string | null) => void;
  onOpenOrder: (
    optionToken: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp: number,
    side: 'BUY' | 'SELL'
  ) => void;
  onOpenChart?: (contract: SelectedOptionContract) => void;
  underlying?: string;
  expiry?: string;
  lotSize?: number;
  exchange?: string;
  isMobile?: boolean;
}

export const formatQty = (num?: number): string => {
  if (!num || num === 0) return '-';
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

export const formatChangePct = (val?: number): { text: string; isPos: boolean } => {
  if (val === undefined || val === null || isNaN(val)) return { text: '0.00%', isPos: true };
  const sign = val >= 0 ? '+' : '';
  return { text: `${sign}${val.toFixed(2)}%`, isPos: val >= 0 };
};

export const getOiBuildup = (priceChangePct?: number, oiChange?: number) => {
  if (!priceChangePct || !oiChange || oiChange === 0) return null;
  if (oiChange > 0 && priceChangePct > 0) return { label: 'Long Buildup', code: 'LB', cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' };
  if (oiChange > 0 && priceChangePct < 0) return { label: 'Short Buildup', code: 'SB', cls: 'text-rose-500 bg-rose-500/10 border-rose-500/30' };
  if (oiChange < 0 && priceChangePct > 0) return { label: 'Short Covering', code: 'SC', cls: 'text-teal-500 bg-teal-500/10 border-teal-500/30' };
  if (oiChange < 0 && priceChangePct < 0) return { label: 'Long Unwinding', code: 'LU', cls: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
  return null;
};

export const OptionChainRowComponent: React.FC<OptionChainRowProps> = ({
  row,
  isAtm,
  spotPrice,
  viewMode,
  ceTick,
  peTick,
  activeLtpKey,
  onSelectLtp,
  onOpenOrder,
  onOpenChart,
  underlying = 'SENSEX',
  expiry = '',
  lotSize = 20,
  exchange = 'BSE',
  isMobile = false,
}) => {
  // Resolve live LTP and change% from WebSocket tick or static row fallback
  const ceLtp = ceTick?.ltp && ceTick.ltp > 0 ? ceTick.ltp : row.ce.ltp;
  const peLtp = peTick?.ltp && peTick.ltp > 0 ? peTick.ltp : row.pe.ltp;

  const ceChangePct = (ceTick?.changePercent !== undefined && !isNaN(ceTick.changePercent)) 
    ? ceTick.changePercent 
    : (row.ce.changePercent !== undefined && !isNaN(row.ce.changePercent))
      ? row.ce.changePercent
      : (row.ce.change ? (row.ce.change / (ceLtp - row.ce.change || 1)) * 100 : 0);

  const peChangePct = (peTick?.changePercent !== undefined && !isNaN(peTick.changePercent)) 
    ? peTick.changePercent 
    : (row.pe.changePercent !== undefined && !isNaN(row.pe.changePercent))
      ? row.pe.changePercent
      : (row.pe.change ? (row.pe.change / (peLtp - row.pe.change || 1)) * 100 : 0);

  const ceBuildup = getOiBuildup(ceChangePct, row.ce.openInterestChange);
  const peBuildup = getOiBuildup(peChangePct, row.pe.openInterestChange);

  const prevCeLtpRef = useRef<number>(ceLtp);
  const prevPeLtpRef = useRef<number>(peLtp);

  const [ceFlashClass, setCeFlashClass] = useState<'price-flash-up' | 'price-flash-down' | ''>('');
  const [peFlashClass, setPeFlashClass] = useState<'price-flash-up' | 'price-flash-down' | ''>('');

  // Call (CE) Price Flash Animation
  useEffect(() => {
    if (ceLtp === prevCeLtpRef.current) return;
    if (ceLtp > prevCeLtpRef.current) {
      setCeFlashClass('price-flash-up');
    } else if (ceLtp < prevCeLtpRef.current) {
      setCeFlashClass('price-flash-down');
    }
    prevCeLtpRef.current = ceLtp;

    const timer = setTimeout(() => {
      setCeFlashClass('');
    }, 350);
    return () => clearTimeout(timer);
  }, [ceLtp]);

  // Put (PE) Price Flash Animation
  useEffect(() => {
    if (peLtp === prevPeLtpRef.current) return;
    if (peLtp > prevPeLtpRef.current) {
      setPeFlashClass('price-flash-up');
    } else if (peLtp < prevPeLtpRef.current) {
      setPeFlashClass('price-flash-down');
    }
    prevPeLtpRef.current = peLtp;

    const timer = setTimeout(() => {
      setPeFlashClass('');
    }, 350);
    return () => clearTimeout(timer);
  }, [peLtp]);

  // ITM Calculations
  const isCeItm = row.strikePrice < spotPrice;
  const isPeItm = row.strikePrice > spotPrice;

  // PCR Calculation for Strike
  const callOi = row.ce.openInterest || 1;
  const putOi = row.pe.openInterest || 0;
  const pcrVal = (putOi / callOi).toFixed(2);

  const ceKey = `${row.strikePrice}_CE`;
  const peKey = `${row.strikePrice}_PE`;

  const isCeActive = activeLtpKey === ceKey;
  const isPeActive = activeLtpKey === peKey;

  const formattedCePct = formatChangePct(ceChangePct);
  const formattedPePct = formatChangePct(peChangePct);

  const handleOpenCeChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOpenChart) return;
    onOpenChart({
      underlying,
      symbol: `${underlying} ${row.strikePrice} CE`,
      strike: row.strikePrice,
      optionType: 'CE',
      expiry: expiry || row.expiry || new Date().toISOString().slice(0, 10),
      exchange,
      instrumentToken: row.ce.instrumentToken,
      lotSize,
      initialLtp: ceLtp,
      iv: row.ce.iv,
      delta: row.ce.delta,
      openInterest: row.ce.openInterest,
    });
  };

  const handleOpenPeChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOpenChart) return;
    onOpenChart({
      underlying,
      symbol: `${underlying} ${row.strikePrice} PE`,
      strike: row.strikePrice,
      optionType: 'PE',
      expiry: expiry || row.expiry || new Date().toISOString().slice(0, 10),
      exchange,
      instrumentToken: row.pe.instrumentToken,
      lotSize,
      initialLtp: peLtp,
      iv: row.pe.iv,
      delta: row.pe.delta,
      openInterest: row.pe.openInterest,
    });
  };

  // Render Mobile Row View
  if (isMobile) {
    return (
      <tr
        className={`transition-colors border-b border-[var(--border-color)] text-xs font-mono tabular-nums ${
          isAtm
            ? 'bg-amber-500/10 font-bold border-amber-500/40'
            : 'hover:bg-[var(--bg-surface-elevated)]'
        }`}
      >
        {/* Call Volume */}
        <td className={`py-2 px-1.5 text-left text-[11px] text-[var(--text-muted)] ${isCeItm ? 'bg-[var(--call-bg-itm)]' : ''}`}>
          {formatQty(row.ce.volume)}
        </td>

        {/* CALL LTP Cell (Tap to reveal BUY/SELL/CHART) */}
        <td
          onClick={() => onSelectLtp(isCeActive ? null : ceKey)}
          className={`py-2 px-1 text-center cursor-pointer transition-all duration-150 relative min-h-[44px] min-w-[70px] ${
            isCeItm ? 'bg-[var(--call-bg-itm)] text-[var(--call-accent)]' : 'text-[var(--text-main)]'
          } ${isCeActive ? 'ring-2 ring-[var(--call-accent)] bg-[var(--call-bg-hover)] z-10' : 'hover:bg-[var(--call-bg-itm)]'} ${ceFlashClass}`}
        >
          {isCeActive ? (
            <div className="flex items-center justify-center gap-1 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'BUY');
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                BUY
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'SELL');
                }}
                className="bg-rose-500 hover:bg-rose-400 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                SELL
              </button>
              {onOpenChart && (
                <button
                  type="button"
                  onClick={handleOpenCeChart}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px] flex items-center gap-1"
                  title="Open Strike Chart"
                >
                  <TrendingUp size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`font-bold text-xs ${formattedCePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{ceLtp.toFixed(2)}
              </span>
              <span className={`text-[10px] ${formattedCePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formattedCePct.text}
              </span>
            </div>
          )}
        </td>

        {/* STRIKE PRICE (Center Column with PCR) */}
        <td
          onClick={handleOpenCeChart}
          className={`py-2 px-1.5 text-center font-extrabold border-x border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-surface-elevated)] transition-colors ${
            isAtm ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 font-black' : 'text-[var(--text-main)] bg-[var(--bg-surface-inset)]'
          }`}
          title="Click to view Strike Chart"
        >
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1">
              {row.strikePrice}
              {isAtm && <span className="text-[9px] bg-amber-400 text-slate-950 px-1 rounded font-black">ATM</span>}
            </span>
            <span className="text-[9px] text-[var(--text-muted)] font-medium">PCR: {pcrVal}</span>
          </div>
        </td>

        {/* PUT LTP Cell (Tap to reveal BUY/SELL/CHART) */}
        <td
          onClick={() => onSelectLtp(isPeActive ? null : peKey)}
          className={`py-2 px-1 text-center cursor-pointer transition-all duration-150 relative min-h-[44px] min-w-[70px] ${
            isPeItm ? 'bg-[var(--put-bg-itm)] text-[var(--put-accent)]' : 'text-[var(--text-main)]'
          } ${isPeActive ? 'ring-2 ring-[var(--put-accent)] bg-[var(--put-bg-hover)] z-10' : 'hover:bg-[var(--put-bg-itm)]'} ${peFlashClass}`}
        >
          {isPeActive ? (
            <div className="flex items-center justify-center gap-1 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'BUY');
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                BUY
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'SELL');
                }}
                className="bg-rose-500 hover:bg-rose-400 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                SELL
              </button>
              {onOpenChart && (
                <button
                  type="button"
                  onClick={handleOpenPeChart}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px] flex items-center gap-1"
                  title="Open Strike Chart"
                >
                  <TrendingUp size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`font-bold text-xs ${formattedPePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{peLtp.toFixed(2)}
              </span>
              <span className={`text-[10px] ${formattedPePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formattedPePct.text}
              </span>
            </div>
          )}
        </td>

        {/* Put Volume */}
        <td className={`py-2 px-1.5 text-right text-[11px] text-[var(--text-muted)] ${isPeItm ? 'bg-[var(--put-bg-itm)]' : ''}`}>
          {formatQty(row.pe.volume)}
        </td>
      </tr>
    );
  }

  // Render Desktop Multi-Column Table Row (Matching Reference)
  return (
    <tr
      className={`transition-colors border-b border-[var(--border-color)] text-xs font-mono tabular-nums ${
        isAtm
          ? 'bg-amber-500/10 border-y border-amber-500/40 font-bold'
          : 'hover:bg-[var(--bg-surface-elevated)]'
      }`}
    >
      {/* --- CALLS (CE) SIDE --- */}
      {viewMode === 'GREEKS' ? (
        <>
          <td className={`py-2.5 px-3 text-[var(--text-muted)] ${isCeItm ? 'bg-[var(--call-bg-itm)]' : ''}`}>
            Δ {row.ce.delta?.toFixed(2) || '0.50'}
          </td>
          <td className={`py-2.5 px-3 text-[var(--text-muted)] ${isCeItm ? 'bg-[var(--call-bg-itm)]' : ''}`}>
            IV {row.ce.iv?.toFixed(1) || '12.0'}%
          </td>
        </>
      ) : (
        <>
          {/* CALL Volume */}
          <td className={`py-2.5 px-3 text-[var(--text-main)] text-left ${isCeItm ? 'bg-[var(--call-bg-itm)]' : ''}`}>
            {formatQty(row.ce.volume)}
          </td>

          {/* CALL OI Change (Change%) */}
          <td className={`py-2.5 px-3 text-[var(--text-muted)] text-left ${isCeItm ? 'bg-[var(--call-bg-itm)]' : ''}`}>
            <div className="flex items-center gap-1.5">
              <span>{formatQty(row.ce.openInterestChange)} {row.ce.openInterestChange ? `(${(row.ce.openInterestChange / (row.ce.openInterest || 1) * 100).toFixed(1)}%)` : ''}</span>
              {ceBuildup && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${ceBuildup.cls}`} title={ceBuildup.label}>
                  {ceBuildup.code}
                </span>
              )}
            </div>
          </td>

          {/* CALL OI */}
          <td className={`py-2.5 px-3 text-[var(--text-main)] text-left ${isCeItm ? 'bg-[var(--call-bg-itm)]' : ''}`}>
            {formatQty(row.ce.openInterest)}
          </td>
        </>
      )}

      {/* CALL LTP CELL (Hover / Click Contextual BUY/SELL/CHART interaction) */}
      <td
        onClick={() => onSelectLtp(isCeActive ? null : ceKey)}
        className={`py-2.5 px-3 text-right cursor-pointer transition-all duration-150 relative min-w-[130px] ${
          isCeItm ? 'bg-[var(--call-bg-itm)] text-[var(--call-accent)] font-bold' : 'text-[var(--call-accent)] font-bold'
        } ${isCeActive ? 'ring-2 ring-emerald-400 bg-[var(--call-bg-hover)] shadow-lg z-10' : 'hover:bg-[var(--call-bg-hover)] group'} ${ceFlashClass}`}
      >
        {isCeActive ? (
          <div className="flex items-center justify-end gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'BUY');
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              BUY
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'SELL');
              }}
              className="bg-rose-500 hover:bg-rose-400 text-white font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              SELL
            </button>
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenCeChart}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-2 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform flex items-center gap-1"
                title="Open CE Strike Chart"
              >
                <TrendingUp size={12} /> Chart
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenCeChart}
                className="p-1 rounded bg-[var(--bg-surface-elevated)] hover:bg-blue-600 text-[var(--text-muted)] hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="View Strike Chart"
              >
                <TrendingUp size={12} />
              </button>
            )}
            <span className={`text-xs font-bold ${formattedCePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{ceLtp.toFixed(2)}
            </span>
            <span className={`text-[11px] ${formattedCePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
              ({formattedCePct.text})
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--call-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </td>

      {/* --- STRIKE PRICE (CENTER COLUMN) --- */}
      <td
        onClick={handleOpenCeChart}
        className={`py-2.5 px-4 font-extrabold text-sm border-x border-[var(--border-color)] text-center cursor-pointer hover:bg-[var(--bg-surface)] transition-colors ${
          isAtm
            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 font-black tracking-wider shadow-inner'
            : 'text-[var(--text-main)] bg-[var(--bg-surface-inset)]'
        }`}
        title="Click to view Strike Chart"
      >
        <div className="flex items-center justify-center gap-1 font-mono">
          <span>{row.strikePrice}</span>
          {isAtm && (
            <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">
              ATM
            </span>
          )}
        </div>
      </td>

      {/* --- PUTS (PE) SIDE --- */}
      {/* PUT LTP CELL (Hover / Click Contextual BUY/SELL/CHART interaction) */}
      <td
        onClick={() => onSelectLtp(isPeActive ? null : peKey)}
        className={`py-2.5 px-3 text-left cursor-pointer transition-all duration-150 relative min-w-[130px] ${
          isPeItm ? 'bg-[var(--put-bg-itm)] text-[var(--put-accent)] font-bold' : 'text-[var(--put-accent)] font-bold'
        } ${isPeActive ? 'ring-2 ring-emerald-400 bg-[var(--put-bg-hover)] shadow-lg z-10' : 'hover:bg-[var(--put-bg-hover)] group'} ${peFlashClass}`}
      >
        {isPeActive ? (
          <div className="flex items-center justify-start gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'BUY');
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              BUY
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'SELL');
              }}
              className="bg-rose-500 hover:bg-rose-400 text-white font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              SELL
            </button>
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenPeChart}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-2 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform flex items-center gap-1"
                title="Open PE Strike Chart"
              >
                <TrendingUp size={12} /> Chart
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-start gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--put-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className={`text-xs font-bold ${formattedPePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{peLtp.toFixed(2)}
            </span>
            <span className={`text-[11px] ${formattedPePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
              ({formattedPePct.text})
            </span>
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenPeChart}
                className="p-1 rounded bg-[var(--bg-surface-elevated)] hover:bg-blue-600 text-[var(--text-muted)] hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="View Strike Chart"
              >
                <TrendingUp size={12} />
              </button>
            )}
          </div>
        )}
      </td>

      {viewMode === 'GREEKS' ? (
        <>
          <td className={`py-2.5 px-3 text-[var(--text-muted)] ${isPeItm ? 'bg-[var(--put-bg-itm)]' : ''}`}>
            IV {row.pe.iv?.toFixed(1) || '12.0'}%
          </td>
          <td className={`py-2.5 px-3 text-[var(--text-muted)] ${isPeItm ? 'bg-[var(--put-bg-itm)]' : ''}`}>
            Δ {row.pe.delta?.toFixed(2) || '0.50'}
          </td>
        </>
      ) : (
        <>
          {/* PUT OI */}
          <td className={`py-2.5 px-3 text-[var(--text-main)] text-right ${isPeItm ? 'bg-[var(--put-bg-itm)]' : ''}`}>
            {formatQty(row.pe.openInterest)}
          </td>

          {/* PUT OI Change (Change%) */}
          <td className={`py-2.5 px-3 text-[var(--text-muted)] text-right ${isPeItm ? 'bg-[var(--put-bg-itm)]' : ''}`}>
            <div className="flex items-center justify-end gap-1.5">
              {peBuildup && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${peBuildup.cls}`} title={peBuildup.label}>
                  {peBuildup.code}
                </span>
              )}
              <span>{formatQty(row.pe.openInterestChange)} {row.pe.openInterestChange ? `(${(row.pe.openInterestChange / (row.pe.openInterest || 1) * 100).toFixed(1)}%)` : ''}</span>
            </div>
          </td>

          {/* PUT Volume */}
          <td className={`py-2.5 px-3 text-[var(--text-main)] text-right ${isPeItm ? 'bg-[var(--put-bg-itm)]' : ''}`}>
            {formatQty(row.pe.volume)}
          </td>
        </>
      )}
    </tr>
  );
};

export const OptionChainRow = React.memo(
  OptionChainRowComponent,
  (prevProps, nextProps) => {
    const prevCeLtp = prevProps.ceTick?.ltp ?? prevProps.row.ce.ltp;
    const nextCeLtp = nextProps.ceTick?.ltp ?? nextProps.row.ce.ltp;

    const prevPeLtp = prevProps.peTick?.ltp ?? prevProps.row.pe.ltp;
    const nextPeLtp = nextProps.peTick?.ltp ?? nextProps.row.pe.ltp;

    const prevCeVol = prevProps.ceTick?.volume ?? prevProps.row.ce.volume;
    const nextCeVol = nextProps.ceTick?.volume ?? nextProps.row.ce.volume;

    const prevPeVol = prevProps.peTick?.volume ?? prevProps.row.pe.volume;
    const nextPeVol = nextProps.peTick?.volume ?? nextProps.row.pe.volume;

    const prevCeBid = prevProps.ceTick?.bid ?? prevProps.row.ce.bid;
    const nextCeBid = nextProps.ceTick?.bid ?? nextProps.row.ce.bid;

    const prevPeBid = prevProps.peTick?.bid ?? prevProps.row.pe.bid;
    const nextPeBid = nextProps.peTick?.bid ?? nextProps.row.pe.bid;

    return (
      prevProps.row.strikePrice === nextProps.row.strikePrice &&
      prevProps.isAtm === nextProps.isAtm &&
      prevProps.spotPrice === nextProps.spotPrice &&
      prevProps.viewMode === nextProps.viewMode &&
      prevProps.activeLtpKey === nextProps.activeLtpKey &&
      prevProps.isMobile === nextProps.isMobile &&
      prevCeLtp === nextCeLtp &&
      prevPeLtp === nextPeLtp &&
      prevCeVol === nextCeVol &&
      prevPeVol === nextPeVol &&
      prevCeBid === nextCeBid &&
      prevPeBid === nextPeBid
    );
  }
);
