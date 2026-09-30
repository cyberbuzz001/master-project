/**
 * AI customer-support agent for the live chat feature (chatMessages.ts).
 *
 * Primary AI Engine: Google Gemini API (gemini-3-flash-preview / gemini-3.1-flash-lite-preview).
 * Fires once per customer-sent chat message — see the two call sites in
 * websocket/server.ts (CHAT_SEND) and routes/api.ts (REST fallback).
 *
 * The account snapshot is built here, server-side, from the authenticated
 * customerId the caller already resolved — never from anything the model
 * outputs — so there is no way for a prompt to make the bot look up, or
 * leak, a different customer's data.
 */
import { queryOne, query } from '../db/schema';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { PortfolioService } from '../trading/PortfolioService';
import { recordChatMessage, getChatHistory, ChatMessageRow } from './chatMessages';
import { SUPPORT_KNOWLEDGE_BASE } from './supportKnowledgeBase';
import { isOrderWindowOpen } from './marketHours';

export const AI_BOT_USER_ID = 'usr_ai_support_bot';
const AI_BOT_SENDER_ROLE = 'SUPPORT_AGENT';
const HISTORY_TURNS = 12;

function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

async function buildAccountSnapshot(customerId: string): Promise<string> {
  const [user, wallet, positions, kyc, fundRequests] = await Promise.all([
    queryOne<any>('SELECT username, client_id FROM users WHERE id = $1', [customerId]),
    VirtualWalletLedger.getWallet(customerId),
    PortfolioService.getUserPositions(customerId, false),
    queryOne<any>('SELECT status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [customerId]),
    query<any>('SELECT request_type, amount, status, created_at FROM fund_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3', [customerId]),
  ]);

  const openPositions = positions.filter((p) => p.netQty !== 0);
  const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const lines: string[] = [];
  const nowIST = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date());
  const [equity, commodity] = await Promise.all([isOrderWindowOpen('NSE'), isOrderWindowOpen('MCX')]);
  lines.push(`Current time: ${nowIST} IST`);
  lines.push(`Equity/F&O market right now: ${equity.open ? 'OPEN — orders accepted' : `CLOSED — ${equity.reason}`}`);
  lines.push(`MCX commodity market right now: ${commodity.open ? 'OPEN — orders accepted' : `CLOSED — ${commodity.reason}`}`);
  lines.push(`Customer: ${user?.username || 'unknown'} (Client ID: ${user?.client_id || 'unknown'})`);
  lines.push(`KYC status: ${kyc?.status || 'NOT_STARTED'}`);
  if (wallet) {
    lines.push(
      `Wallet — Cash balance: ${inr(wallet.cashBalance)}, Used margin: ${inr(wallet.usedMargin)}, ` +
      `Buying power: ${inr(wallet.buyingPower)}, Withdrawable balance: ${inr(wallet.withdrawableBalance)}, ` +
      `Realized P&L: ${inr(wallet.realizedPnl)}, Unrealized P&L: ${inr(wallet.unrealizedPnl)}`
    );
  } else {
    lines.push('Wallet — no virtual wallet found for this account.');
  }
  lines.push(
    openPositions.length === 0
      ? 'Open positions: none'
      : `Open positions (${openPositions.length}): ` + openPositions.slice(0, 5)
          .map((p) => `${p.symbol} netQty ${p.netQty} @ avg ${inr(p.averagePrice)}, P&L ${inr(p.unrealizedPnl)}`)
          .join('; ')
  );
  lines.push(
    fundRequests.length === 0
      ? 'Recent fund requests: none'
      : 'Recent fund requests: ' + fundRequests
          .map((f) => `${f.request_type} ${inr(parseFloat(f.amount))} — ${f.status} (${new Date(f.created_at).toLocaleDateString('en-IN')})`)
          .join('; ')
  );
  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are the TradeGrow Support Assistant, an AI customer-support agent for TradeGrow, an Indian equity & F&O trading platform (NSE/BSE, intraday and options).

You are replying inside a live chat with one specific logged-in customer. A per-customer account snapshot is appended after this message — treat it as ground truth, never invent numbers, and never discuss or imply knowledge of any account other than this one.

Guidelines:
- Keep replies helpful, clear, and concise: 1–3 sentences, plain conversational text (no markdown tables, headings, or code blocks — this renders inside a small chat bubble).
- Always answer the customer's LATEST message directly based on their specific intent.
- KYC Queries: Check the account snapshot. If KYC status is APPROVED or SUBMITTED, tell them clearly that their KYC is already approved/submitted and fully active, so no further verification is required. If NOT_STARTED or REJECTED, guide them to Profile > KYC.
- Funds & Withdrawals: For withdrawal questions, explain that payouts are requested under Profile > Funds > Withdraw, and state their current Withdrawable Balance from the snapshot. For deposit queries, state their recent deposit status and guide to +Add Funds.
- Orders & Trading: Explain that orders can be placed from Watchlist, Option Chain, or Pro Terminal during market hours.
- Brokerage & Charges: TradeGrow charges ₹0 brokerage and ₹0 platform tax or fee across equity delivery, intraday, and F&O.
- Strictly non-advisory: Never give stock tips, buy/sell recommendations, or price predictions.
- If asking for human support: Invite them to leave their query or email support@tradegrowx.in (Mon–Fri 9:00 AM–6:00 PM IST).

<reference_facts>
${SUPPORT_KNOWLEDGE_BASE}
</reference_facts>`;

function isGenericGreeting(msg: string): boolean {
  const m = msg.toLowerCase().trim();
  return m.includes('welcome to tradegrow') || m.includes('how can i assist you') || m.includes('how can i help you');
}

const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
  process.env.GEMINI_MODEL,
].filter(Boolean) as string[];

async function generateWithGemini(snapshot: string, history: ChatMessageRow[]): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) return null;

  const firstUserIdx = history.findIndex((r) => r.sender_role === 'USER');
  const trimmed = firstUserIdx === -1 ? [] : history.slice(firstUserIdx);
  if (trimmed.length === 0) return null;

  // Ensure alternating turns for Gemini: user -> model -> user ...
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const r = trimmed[i];
    // Skip historical generic greetings if followed by subsequent user questions
    if (r.sender_role !== 'USER' && isGenericGreeting(r.message) && i < trimmed.length - 1) {
      continue;
    }
    const role: 'user' | 'model' = r.sender_role === 'USER' ? 'user' : 'model';
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n${r.message}`;
    } else {
      contents.push({ role, parts: [{ text: r.message }] });
    }
  }

  // Gemini requires the final message to be from 'user'
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    const latestUserMsg = trimmed.filter((r) => r.sender_role === 'USER').pop();
    if (latestUserMsg) {
      contents.push({ role: 'user', parts: [{ text: latestUserMsg.message }] });
    } else {
      return null;
    }
  }

  const fullSystemInstruction = `${SYSTEM_PROMPT}\n\n<account_snapshot>\n${snapshot}\n</account_snapshot>`;

  for (const modelCandidate of GEMINI_MODELS) {
    const cleanModel = modelCandidate.startsWith('models/') ? modelCandidate : `models/${modelCandidate}`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${cleanModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: fullSystemInstruction }] },
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.25,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn(`[SupportBot] Gemini (${cleanModel}) returned ${res.status}:`, JSON.stringify(errData).slice(0, 160));
        continue;
      }

      const data: any = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')?.trim();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[SupportBot] Error with ${cleanModel}:`, err?.message || err);
    }
  }

  return null;
}

/**
 * Generates and persists an AI reply for the customer's latest message using Google Gemini.
 * Returns the persisted row (for the caller to push over the live socket via deliverToUser)
 * or null if no reply was sent.
 */
export async function maybeGenerateSupportBotReply(customerId: string): Promise<ChatMessageRow | null> {
  if (!hasGeminiKey()) {
    console.warn('[SupportBot] GEMINI_API_KEY / GOOGLE_API_KEY is not configured — AI auto-replies disabled.');
    return null;
  }

  try {
    const [snapshot, history] = await Promise.all([
      buildAccountSnapshot(customerId),
      getChatHistory(customerId, HISTORY_TURNS),
    ]);

    const replyText = await generateWithGemini(snapshot, history);
    if (!replyText) return null;

    console.log(`[SupportBot] Generated reply for customer ${customerId} using Google Gemini.`);
    return await recordChatMessage(customerId, AI_BOT_USER_ID, AI_BOT_SENDER_ROLE, replyText.slice(0, 4000));
  } catch (err: any) {
    console.error('[SupportBot] Failed to generate reply:', err?.message || err);
    return null;
  }
}
