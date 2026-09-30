-- ============================================================================
-- Migration: 037_warroom_seed_100_content_ideas.sql
-- Description: Seeds the complete 100 Production Content & Ad Scripts into
--              warroom.content_ideas for the 90-Day 1,000 Active Users War Room.
-- Compliance: Fully SEBI Ad Code compliant (no guaranteed returns, clear risk disclaimers)
-- ============================================================================

INSERT INTO warroom.content_ideas (
    idea_index, category, hook, script_body, visual_direction, caption, call_to_action, target_audience, funnel_stage, compliance_approved, publication_status
) VALUES
-- ============================================================================
-- PILLAR 1: TRADING EDUCATION & DEMAT LITERACY (IDs 1 - 25)
-- ============================================================================
(1, 'Trading Education', 
 'Why 90% of option buyers lose money in the first 15 minutes of market open',
 'At 9:15 AM, implied volatility spikes and bid-ask spreads widen significantly. Retail traders jump into at-the-money calls hoping for a quick scalp, only to see option premium collapse even if the underlying moves in their favor. Learn how theta decay and IV crush work before placing your next intraday order.',
 'Split-screen: Nifty 5-minute candle surging green while call option premium falls due to IV crush. Highlight Greeks widget on Trade Grow terminal.',
 'Understand why option premiums behave unpredictably right after market open. Master Greeks before trading. #TradingEducation #OptionsTrading #TradeGrow',
 'Learn Greeks on Trade Grow', 'Active Retail Traders', 'TOFU', TRUE, 'PUBLISHED'),

(2, 'Trading Education',
 'What is a Demat Account vs a Trading Account? The 60-second explanation',
 'Think of your Bank Account as where your cash sits. Your Demat Account is like a digital locker where your share certificates are stored safely with NSDL or CDSL. Your Trading Account is the bridge that executes your buy and sell orders on the exchange. Trade Grow gives you both integrated in one 3-minute paperless setup.',
 'Clean motion graphic: Rupee notes in Bank -> Trading bridge -> Digital locker holding share certificates.',
 'Confused about Demat vs Trading account? Here is the simplest explanation you will ever need. #DematBasics #StockMarketIndia',
 'Open 3-Min Paperless Demat', 'First-Time Investors', 'TOFU', TRUE, 'PUBLISHED'),

(3, 'Trading Education',
 'How Bid-Ask Spread eats away your profits without you realizing it',
 'When you buy at market price in an illiquid contract, you are paying the ask price. If the bid is 5 rupees lower, you are instantly down 5 rupees per share before the market even moves. Trade Grow displays deep market depth ladders with live liquidity highlights.',
 'Close-up of Level 2 market depth ladder showing wide vs narrow spread impact on instantaneous P&L.',
 'Stop losing money to hidden spread costs. Always check the bid-ask ladder before trading. #MarketDepth #SmartTrading',
 'Explore Trade Grow Terminal', 'Intraday Traders', 'MOFU', TRUE, 'SCHEDULED'),

(4, 'Trading Education',
 'Stop-Loss Market (SL-M) vs Stop-Loss Limit (SL-L): Avoid slippage disasters',
 'During rapid flash crashes, an SL-M order converts to a market order and can get filled 50 points away from your trigger. An SL-L order guarantees your exit price or better. Trade Grow makes configuring SL-L simple with predefined buffer presets.',
 'Demonstration of order placement window highlighting trigger price vs limit price with visual buffer sliders.',
 'Protect your capital against freak trade slippage with proper Stop-Loss Limit orders. #RiskManagement #TradeGrow',
 'Practice on Simulated Terminal', 'Active Traders', 'MOFU', TRUE, 'SCHEDULED'),

(5, 'Trading Education',
 'The truth about PCR (Put-Call Ratio) in Nifty and Bank Nifty',
 'A PCR above 1.3 does not mean you should blindly buy calls. In extreme bullish trending markets, high PCR can persist for days, while at range-bound extremes it signals contrarian overbought levels. Here is how institutional desks read open interest.',
 'Interactive Open Interest bar chart updating live alongside Nifty intraday trajectory.',
 'Learn how to read Put-Call Ratio like professional desks without relying on delayed tips. #OpenInterest #NiftyAnalysis',
 'View Live Option Chain', 'Derivatives Traders', 'MOFU', TRUE, 'SCHEDULED'),

(6, 'Trading Education',
 'What is Cash-and-Carry (CNC) vs Margin Intraday Square-off (MIS)?',
 'CNC means you pay 100% upfront and hold shares in your demat account for weeks, months, or years with zero leverage risk. MIS gives you up to 5x leverage but automatically squares off at 3:15 PM. Choose the right product code for your trading horizon.',
 'Comparison card showing CNC holding timeline vs MIS 3:15 PM auto square-off timer.',
 'Never get caught in auto-square off penalties. Understand CNC vs MIS product codes. #ShareMarket #InvestingTips',
 'Open Zero AMC Demat', 'Beginner Traders', 'TOFU', TRUE, 'SCHEDULED'),

(7, 'Trading Education',
 'How Dividend Yield actually works when shares go Ex-Dividend',
 'When a company pays a 50 rupee dividend, its share price is automatically adjusted downward by exactly 50 rupees on the ex-dividend date. Dividends are not free money; they are a return of capital.',
 'Visual timeline of Announcement Date -> Record Date -> Ex-Date with price adjustment chart.',
 'Dividends are not free money. Learn the mechanics of corporate actions on Trade Grow. #Dividends #StockEducation',
 'Explore Trade Grow Research', 'Long-term Investors', 'TOFU', TRUE, 'SCHEDULED'),

(8, 'Trading Education',
 'What is Implied Volatility (IV) and why does it crash on Election/Budget days?',
 'Before major news events, IV surges because market participants buy protection at any price. The moment the news is announced, uncertainty disappears and IV plummets—causing both CE and PE buyers to lose money regardless of market direction.',
 'Historic volatility smile curve collapsing post-event while straddle premium drops 40%.',
 'Why options buyers lose money even when guessing the event direction right. #IVCrush #TradingWisdom',
 'Master Option Greeks', 'Advanced Traders', 'MOFU', TRUE, 'SCHEDULED'),

(9, 'Trading Education',
 'Why Paper Trading is the essential first step before risking real rupees',
 'Professional athletes spend 10,000 hours in practice before entering the championship. Why risk hard-earned savings in live markets without testing your trading plan? Trade Grow provides a 100% realistic simulated terminal with live tick data.',
 'Trader testing breakout strategy on simulated terminal with live tick executions and zero rupee risk.',
 'Build muscle memory, master discipline, and test your strategy with zero financial risk. #PaperTrading #TradeGrow',
 'Start Free Simulated Trading', 'New Traders', 'BOFU', TRUE, 'PUBLISHED'),

(10, 'Trading Education',
 'Understanding Circuit Breakers: Lower Circuit & Upper Circuit rules in India',
 'When an equity stock hits 5%, 10%, or 20% price band, trading is halted. In lower circuit stocks, there are only sellers and zero buyers, making it impossible to exit. Here is how to identify liquidity risk before entering small-cap stocks.',
 'Animated order book showing 10,000 sell orders and 0 buy orders at lower circuit limit.',
 'Avoid getting trapped in illiquid lower circuit stocks. Learn circuit breaker mechanics. #RiskFirst #SEBIAwareness',
 'Verify Liquidity on Trade Grow', 'Retail Investors', 'TOFU', TRUE, 'SCHEDULED'),

(11, 'Trading Education', 'Trailing Stop Loss: How to protect open profits without exiting too early', 'Learn step-by-step how to lock in gains dynamically as your stock moves in your favor.', 'Screen recording of trailing stop trigger adjusting automatically.', 'Lock in profits systematically. #TrailingStopLoss', 'Try Trailing SL', 'Day Traders', 'MOFU', TRUE, 'SCHEDULED'),
(12, 'Trading Education', 'What is Beta in stocks and how does it measure market volatility?', 'A beta of 1.5 means the stock moves 50% more than the Nifty index.', 'Visual showing Nifty moving 1% vs high-beta stock moving 2.5%.', 'Measure your portfolio sensitivity with Beta. #StockMetrics', 'Check Stock Beta', 'Investors', 'TOFU', TRUE, 'SCHEDULED'),
(13, 'Trading Education', 'Candlestick Wicks vs Bodies: What market rejection really looks like', 'Long lower wicks indicate institutional buying rejection at support zones.', 'Candlestick zoom showing buyer absorption at day low.', 'Read the story behind price action candles. #PriceAction', 'Analyze Charts on Trade Grow', 'Technical Traders', 'MOFU', TRUE, 'SCHEDULED'),
(14, 'Trading Education', 'Support & Resistance: Why horizontal levels beat diagonal trendlines', 'Horizontal support represents true order book accumulation from institutions.', 'Chart comparison showing horizontal supply-demand vs subjective trendlines.', 'Find high-probability reaction levels with horizontal zones. #S_R_Trading', 'Open Free Charting Setup', 'Traders', 'MOFU', TRUE, 'SCHEDULED'),
(15, 'Trading Education', 'Volume Weighted Average Price (VWAP): The institutional benchmark', 'Institutional execution algorithms benchmark performance against intraday VWAP.', 'VWAP line acting as dynamic support on 5-min intraday chart.', 'Trade with institutional momentum using VWAP. #VWAP', 'Trade with VWAP', 'Intraday Traders', 'MOFU', TRUE, 'SCHEDULED'),
(16, 'Trading Education', 'Exponential Moving Average (EMA) crossovers: Fact vs Fiction', 'Golden crosses lag price action; learn how to use EMA as dynamic pullback entries.', '9 and 21 EMA trailing price on trend day.', 'Stop chasing lagging signals. Use EMAs for pullback entries. #EMA', 'Test EMA Strategies', 'Swing Traders', 'TOFU', TRUE, 'SCHEDULED'),
(17, 'Trading Education', 'Understanding Delivery Percentage in NSE equity turnover', 'High delivery percentage with surging volume indicates institutional accumulation.', 'Delivery percentage table on Trade Grow stock overview.', 'Spot institutional buying with delivery volume metrics. #DeliveryVolume', 'Check Delivery Stats', 'Investors', 'MOFU', TRUE, 'SCHEDULED'),
(18, 'Trading Education', 'What is Short Selling and how does intraday shorting work in cash market?', 'Sell high first, buy low later before 3:15 PM auto square-off.', 'Animated trade lifecycle of intraday short sale.', 'Learn how traders capitalize on falling markets. #ShortSelling', 'Explore Shorting on Terminal', 'Beginners', 'TOFU', TRUE, 'SCHEDULED'),
(19, 'Trading Education', 'NSE vs BSE: What is the difference between India''s premier exchanges?', 'NSE dominates F&O liquidity; BSE is Asia''s oldest exchange with exclusive listings.', 'Side-by-side logo infographic comparing founding year, turnover, and indices.', 'Know the venues where your trades are executed. #NSE #BSE', 'Trade on Both Exchanges', 'New Investors', 'TOFU', TRUE, 'SCHEDULED'),
(20, 'Trading Education', 'How STT, GST, and Stamp Duty are calculated on your trade bill', 'Every statutory levy broken down down to the exact paisa.', 'Transparent contract note breakdown calculation.', 'No hidden surprises on your trade statement. #FeeTransparency', 'View Transparent Charges', 'Active Traders', 'TOFU', TRUE, 'SCHEDULED'),
(21, 'Trading Education', 'What is Open Interest (OI) buildup: Long Buildup vs Short Covering', 'Differentiate fresh institutional buying from quick short covering rallies.', '4-quadrant diagram of Price vs Open Interest analysis.', 'Decode institutional positioning with OI analysis. #OpenInterest', 'Check Live OI Chain', 'F&O Traders', 'MOFU', TRUE, 'SCHEDULED'),
(22, 'Trading Education', 'Understanding Time Decay (Theta): The silent killer of option buyers', 'Every second you hold an out-of-the-money option, theta decay eats your premium.', 'Hourglass animation draining option premium value over 5 trading days.', 'Why time is the option buyer''s biggest enemy. #ThetaDecay', 'Calculate Greeks Instantly', 'Options Traders', 'MOFU', TRUE, 'SCHEDULED'),
(23, 'Trading Education', 'What happens on Option Expiry Day at 3:30 PM?', 'In-the-money stock options result in physical delivery; index options cash-settle.', 'Delivery settlement flow diagram for stock options.', 'Avoid unexpected physical delivery margin penalties on expiry day. #ExpiryTrading', 'Read Expiry Rules', 'Derivatives Traders', 'MOFU', TRUE, 'SCHEDULED'),
(24, 'Trading Education', 'How to read a Market Depth 5-level Order Book', 'Understanding order queue priority, limit orders, and market liquidity depth.', 'Live Level 2 order book showing bid/ask quantity clusters.', 'Read order flow like professional execution desks. #OrderFlow', 'View Live Depth Book', 'Scalpers', 'MOFU', TRUE, 'SCHEDULED'),
(25, 'Trading Education', 'Why averaging down on losing trades is the fastest way to blow an account', 'Adding to a losing position increases risk on a trade the market already proved wrong.', 'Capital balance depletion curve from repeated averaging down.', 'Cut losses fast, let winners run. Respect your stop loss. #RiskDiscipline', 'Set Risk Guardrails', 'Retail Traders', 'TOFU', TRUE, 'SCHEDULED'),

-- ============================================================================
-- PILLAR 2: PLATFORM TRANSPARENCY & TERMINAL FEATURES (IDs 26 - 45)
-- ============================================================================
(26, 'Platform Features',
 'Watch how fast an order executes on the Trade Grow Terminal',
 'One-click order entry. Sub-second execution confirmation. Live position P&L streaming directly over low-latency WebSockets. Experience a terminal built specifically for Indian active traders.',
 'Screen recording of terminal: clicking BUY, instant modal pop, fill audio chime, P&L card updating.',
 'High performance when every millisecond counts. Explore Trade Grow. #FinTech #DayTrading',
 'Open Account in 3 Minutes', 'Active F&O Traders', 'BOFU', TRUE, 'PUBLISHED'),

(27, 'Platform Features',
 'Option Strategy Builder: Visualize your payoff before risking a single rupee',
 'Building an Iron Condor or Bull Call Spread? Don''t guess your maximum risk. Use Trade Grow''s Strategy Builder to see your exact break-even points, maximum profit, and maximum loss payoff curve instantly.',
 'Terminal screen showing interactive multi-leg payoff graph adjusting as legs are selected.',
 'Never enter an option trade without knowing your exact risk. #OptionsStrategy #TradeGrow',
 'Build Your Strategy', 'Advanced Traders', 'MOFU', TRUE, 'PUBLISHED'),

(28, 'Platform Features',
 'Custom Watchlists with Multi-Window Charting: Your dream trading setup',
 'Track Bank Nifty on one chart, component heavyweights on another, and your option strike on the third—all synchronized in a single lightweight browser tab without paying for third-party charting tools.',
 '3-panel TradingView chart layout in Trade Grow with synchronized crosshairs.',
 'Clean, multi-timeframe charts built directly into your terminal. #TradingDesk #TradeGrow',
 'Explore Trade Grow Charts', 'Technical Analysts', 'MOFU', TRUE, 'PUBLISHED'),

(29, 'Platform Features',
 'Instant Digital Contract Notes: Transparency right after market close',
 'Tired of waiting until midnight to find out what charges you paid? Trade Grow generates your detailed digital contract note breaking down every trade, statutory levy, and net P&L right after market close.',
 'Contract note PDF viewer modal highlighting clear statutory line items.',
 'Complete fee transparency on every single trade. #ZeroHiddenCosts #TradeGrow',
 'Verify Fee Schedule', 'Disillusioned Traders', 'BOFU', TRUE, 'PUBLISHED'),

(30, 'Platform Features', 'One-Click Keyboard Shortcuts for active scalpers', 'Press B to Buy, S to Sell, and Esc to cancel orders instantly without touching the mouse.', 'Overhead keyboard view synchronizing with order fills on screen.', 'Lightning-fast order entry with keyboard shortcuts. #Scalping #TradingShortcuts', 'Try Keyboard Shortcuts', 'Day Traders', 'MOFU', TRUE, 'SCHEDULED'),
(31, 'Platform Features', 'Real-time Position P&L streaming over zero-polling WebSockets', 'Sub-millisecond position updates with green/red flash animations.', 'Phone showing live streaming P&L responding to index ticks.', 'Real-time updates without battery-draining page reloads. #WebSocket #FastTerminal', 'Experience Fast Terminal', 'Active Traders', 'MOFU', TRUE, 'SCHEDULED'),
(32, 'Platform Features', 'Integrated Trading Journal: Tag and review every execution', 'Review why you entered, screenshot your entry candle, and track your win-rate.', 'Journal UI showcasing trade tags: Breakout, Pullback, Revenge Trade.', 'Professional traders review every trade. Use our built-in journal. #TradingJournal', 'Start Journaling Free', 'Disciplined Traders', 'MOFU', TRUE, 'SCHEDULED'),
(33, 'Platform Features', 'Audio Chimes on Order Fills: Hear your executions instantly', 'Crisp audio confirmation on fills so you never double-click by mistake.', 'Sound wave graphic triggering fill sound on terminal execution.', 'Hear your fills with customizable acoustic notifications. #AudioAlerts', 'Enable Sound Alerts', 'Scalpers', 'TOFU', TRUE, 'SCHEDULED'),
(34, 'Platform Features', 'Lightweight dark mode terminal built for long trading sessions', 'Zero eye strain with carefully calibrated slate and emerald dark themes.', 'Side-by-side terminal comparison: Harsh glare vs Trade Grow Dark UI.', 'Designed for traders who spend 6 hours in front of screens. #DarkTheme #UI', 'Switch to Dark Mode', 'Desk Traders', 'TOFU', TRUE, 'SCHEDULED'),
(35, 'Platform Features', 'Multi-Index Ticker Bar: Nifty, BankNifty, Sensex, and FinNifty at a glance', 'Top-pinned real-time indices with net points and percentage change.', 'Terminal header ticker bar streaming live points during market open.', 'Never lose sight of macro indices while trading individual stocks. #IndicesBar', 'Launch Live Ticker', 'Index Traders', 'TOFU', TRUE, 'SCHEDULED'),
(36, 'Platform Features', 'One-Tap Square-Off All Positions: Your emergency circuit breaker', 'Close all open intraday positions instantly if news breaks or connectivity drops.', 'Red emergency button activating confirmation modal with 1-click execution.', 'Instant risk control when market conditions turn volatile. #EmergencyExit', 'Explore RMS Controls', 'Risk Managers', 'MOFU', TRUE, 'SCHEDULED'),
(37, 'Platform Features', 'Interactive P&L Calendar: Track your monthly profitability green days', 'See your daily net profit/loss mapped onto a clean monthly calendar heatmap.', 'Monthly calendar view with emerald green profit days and red risk days.', 'Visualize your trading consistency month over month. #PnLCalendar', 'View Your Calendar', 'Consistent Traders', 'MOFU', TRUE, 'SCHEDULED'),
(38, 'Platform Features', 'Transparent Margin Calculator: Know your required capital before placing order', 'Real-time margin calculation factoring in multi-leg hedging discounts.', 'Margin calculator updating required vs available margin live.', 'Know your exact margin requirements and hedge benefits upfront. #MarginCalculator', 'Calculate Margins', 'Option Sellers', 'MOFU', TRUE, 'SCHEDULED'),
(39, 'Platform Features', 'Mobile Responsive Terminal: Trade seamlessly from any smartphone browser', 'Zero app bloat. Full desktop functionality on your mobile device.', 'Hands holding smartphone navigating responsive trade terminal.', 'Trade on the go with zero compromise on chart speed. #MobileTrading', 'Trade on Mobile', 'Mobile Traders', 'TOFU', TRUE, 'SCHEDULED'),
(40, 'Platform Features', 'Virtual Paper Trading Mode: Test strategies with zero financial risk', 'Toggle between Live and Virtual mode with a single click in your profile.', 'Profile dropdown switching from Live to Virtual Sandbox.', 'Master your strategy in virtual sandbox mode before trading live capital. #SimulatedTrading', 'Try Virtual Sandbox', 'Beginners', 'BOFU', TRUE, 'PUBLISHED'),
(41, 'Platform Features', 'Direct Chart Trading: Place limit orders directly on TradingView charts', 'Drag and drop limit orders and stop losses directly on price levels.', 'Cursor dragging stop loss line up on chart with order update notification.', 'Visual order management directly from your chart. #ChartTrading', 'Enable Chart Trading', 'Price Action Traders', 'MOFU', TRUE, 'SCHEDULED'),
(42, 'Platform Features', 'Instant Basket Orders: Execute multi-leg strategies in one millisecond', 'Bundle up to 20 legs and fire them simultaneously with zero leg-risk.', 'Basket order modal showing 4 option legs executing at once.', 'Eliminate execution lag on complex multi-leg option strategies. #BasketOrders', 'Create Basket Order', 'Option Traders', 'MOFU', TRUE, 'SCHEDULED'),
(43, 'Platform Features', 'Custom Alert Triggers: Get SMS & WhatsApp alerts on price breakouts', 'Set alerts on price, volume, or indicator levels without keeping terminal open.', 'Notification popping up on mobile lock screen with immediate trade action link.', 'Never miss your key price levels even when away from your desk. #PriceAlerts', 'Set Up Free Alerts', 'Working Professionals', 'TOFU', TRUE, 'SCHEDULED'),
(44, 'Platform Features', 'Consolidated Tax P&L Statement: File ITR-2 or ITR-3 in 5 minutes', 'Download clean, CA-ready Capital Gains and F&O turnover statements.', 'PDF statement highlighting Speculative, Non-Speculative, and Capital Gains.', 'Tax filing made painless with automated P&L statements. #TaxFiling #FinTech', 'Download Tax Reports', 'Active Traders', 'MOFU', TRUE, 'SCHEDULED'),
(45, 'Platform Features', 'Bank Account Verification via Instant Penny Drop', 'Zero manual cheque uploads. Instant UPI and IMPS penny drop validation.', 'Animated verification tick verifying ICICI / HDFC bank account in 4 seconds.', 'Seamless, paperless bank linking during account onboarding. #PennyDrop #DigiLocker', 'Link Bank Account', 'Onboarding Users', 'BOFU', TRUE, 'SCHEDULED'),

-- ============================================================================
-- PILLAR 3: REGULATORY, SEBI COMPLIANCE & INVESTOR PROTECTION (IDs 46 - 60)
-- ============================================================================
(46, 'Regulatory & Trust',
 'Don''t just trust a new broker. Here is how to verify one yourself',
 'Every genuine stockbroker in India must be registered with SEBI and hold active membership with NSE, BSE, or MCX. Never deposit money until you check their registration number directly on SEBI''s official portal. At Trade Grow, we don''t ask you to trust us—we invite you to verify our public credentials.',
 'Side-by-side video: typing registration number into SEBI Intermediaries search portal and matching Trade Grow records.',
 'Verify before you trade. An educated investor is a protected investor. #SEBI #InvestorAwareness',
 'Verify Our Credentials', 'Sceptical Investors', 'TOFU', TRUE, 'PUBLISHED'),

(47, 'Regulatory & Trust',
 'The SEBI Investor Charter: What your broker owes you by law',
 'Did you know SEBI mandates that every stockbroker must provide a 4-tier grievance redressal escalation matrix? If your issue isn''t resolved in 30 days, you have the statutory right to escalate directly to SEBI SCORES.',
 'Highlighting Trade Grow''s published Level 1 to Level 4 Escalation Matrix on the trust site.',
 'Know your rights as an investor under the SEBI Investor Charter. #InvestorProtection #SEBI',
 'Read Grievance Matrix', 'General Public', 'TOFU', TRUE, 'PUBLISHED'),

(48, 'Regulatory & Trust',
 'Why Trade Grow refuses to claim ''Zero Tax'' in our advertising',
 'Some platforms advertise ''Zero Brokerage, Zero Tax''. That is illegal and false. Brokerage is our charge—we can waive it. But STT, GST, Stamp Duty, and Exchange fees are statutory taxes set by the Government and SEBI. No broker can waive taxes. We believe in open rules, not misleading marketing.',
 'Invoice breakdown highlighting: "Trade Grow sets this (₹0)" vs "Government sets this (STT/GST)".',
 'Honesty in pricing. We tell you the full truth about trading costs. #TransparentPricing #TradeGrow',
 'See Complete Cost Breakdown', 'Active Traders', 'MOFU', TRUE, 'PUBLISHED'),

(49, 'Regulatory & Trust', 'Client Funds Segregation: Why your money never touches broker operating accounts', 'SEBI daily upstreaming rules mandate that client funds are segregated in clearing corporation accounts.', 'Flowchart showing Client Money going directly to Clearing Corp (NCL/ICCL).', 'Your funds are safeguarded by strict SEBI upstreaming guidelines. #FundSafety', 'Read Fund Safety Policy', 'Cautious Investors', 'TOFU', TRUE, 'SCHEDULED'),
(50, 'Regulatory & Trust', 'Mandatory 2FA: Safeguard your trading terminal against unauthorized access', 'TOTP authenticator app verification on every new login session.', 'Mobile screen generating 6-digit TOTP code and logging in securely.', 'Protect your trading account with hardware and app-based 2FA. #CyberSecurity', 'Enable Two-Factor Auth', 'All Users', 'MOFU', TRUE, 'SCHEDULED'),
(51, 'Regulatory & Trust', 'SEBI Risk Disclosure for Derivatives: 9 out of 10 individual traders incur losses', 'Regulatory mandate: Over 89% of individual F&O traders lost an average of ₹1.1 Lakh.', 'Official SEBI risk disclosure modal displayed clearly before F&O activation.', 'Never risk capital you cannot afford to lose. Trade with discipline. #SEBIDisclosure', 'Understand F&O Risk', 'Derivatives Traders', 'TOFU', TRUE, 'PUBLISHED'),
(52, 'Regulatory & Trust', 'How the SEBI SCORES Portal works if you have an unresolved dispute', 'Step-by-step guide to lodging complaints on SEBI Online Complaint Redress System.', 'Web walkthrough of SEBI SCORES complaint registration workflow.', 'Transparency and accountability: Know your formal regulatory recourse. #SCORES #InvestorRights', 'View Redressal Steps', 'All Investors', 'TOFU', TRUE, 'SCHEDULED'),
(53, 'Regulatory & Trust', 'Why Trade Grow separates Research Advisory from Broker Execution', 'SEBI mandates strict Chinese Walls between independent Research Analysts and Stockbrokers.', 'Diagram showing Chinese Wall separating advisory desk from broker order book.', 'Zero conflict of interest. We do not front-run your orders. #ChineseWall #Ethics', 'Read Governance Blueprint', 'Serious Investors', 'MOFU', TRUE, 'SCHEDULED'),
(54, 'Regulatory & Trust', 'Prevention of Money Laundering Act (PMLA): Why we verify PAN and Bank proofs', 'Statutory compliance requirements that protect the financial ecosystem from bad actors.', 'Document verification checkmarks showing PAN and C-KYC integration.', 'Compliant, safe, and transparent onboarding for genuine Indian citizens. #PMLA #Compliance', 'Complete Verified KYC', 'New Signups', 'BOFU', TRUE, 'SCHEDULED'),
(55, 'Regulatory & Trust', 'Recognizing Stock Market Phishing Scams: What Trade Grow will NEVER ask you', 'We will never ask for your password, OTP, or demand money transfers to private UPI IDs.', 'Infographic of fake Telegram screenshot marked SCAM vs official Trade Grow channel.', 'Stay vigilant against imposter Telegram and WhatsApp channels. #FraudPrevention', 'Report Suspicious Activity', 'Public', 'TOFU', TRUE, 'SCHEDULED'),
(56, 'Regulatory & Trust', 'Nomination in Demat Accounts: Protect your family''s financial future', 'SEBI mandates nominee registration to ensure smooth asset transfer without court delays.', '1-click nominee addition screen with Aadhaar e-Sign.', 'Ensure your investments reach your loved ones seamlessly. Add your nominee. #Nomination', 'Add Demat Nominee', 'Account Holders', 'MOFU', TRUE, 'SCHEDULED'),
(57, 'Regulatory & Trust', 'Understanding Dormant Accounts: How to keep your demat account active', 'Accounts with zero transactions for 12 months become dormant under exchange rules.', 'Notification alert showing account status active with 1 annual trade.', 'Keep your account active and avoid re-KYC paperwork with one annual transaction. #DematRules', 'Check Account Status', 'Inactive Users', 'BOFU', TRUE, 'SCHEDULED'),
(58, 'Regulatory & Trust', 'CDSL Easiest & NSDL IDeAS: How to view your shares independent of your broker', 'Verify your share holdings directly on depository portals anytime.', 'CDSL mobile app showing demat holding balance matching broker terminal.', 'Trust but verify: Check your share holdings directly on CDSL/NSDL. #DepositoryTrust', 'Verify Holdings on CDSL', 'Investors', 'TOFU', TRUE, 'SCHEDULED'),
(59, 'Regulatory & Trust', 'Pledging Shares for Trading Margin: Safe and transparent collateral rules', 'Pledge your long-term equity holdings for intraday and F&O margin without selling.', 'Dashboard showing pledged portfolio value and generated margin balance.', 'Unlock trading margin while retaining your stock dividends and ownership. #MarginPledge', 'Learn Margin Pledge', 'Equity Holders', 'MOFU', TRUE, 'SCHEDULED'),
(60, 'Regulatory & Trust', 'SEBI Peak Margin Rules: Why intraday leverage is regulated across India', 'Understanding why 20x to 100x leverage was banned to protect retail traders from debt.', 'Historical leverage graph showing margin risk reduction over years.', 'Regulated margins protect the entire market from systemic leverage crashes. #PeakMargin', 'Understand Margin Rules', 'Active Traders', 'TOFU', TRUE, 'SCHEDULED'),

-- ============================================================================
-- PILLAR 4: PRICING & BROKERAGE TRANSPARENCY (IDs 61 - 75)
-- ============================================================================
(61, 'Pricing & Charges',
 'How much did you pay in brokerage last year? Let''s calculate',
 'If you execute 4 intraday orders a day at ₹20 per order, you pay ₹19,200 a year just in brokerage—before taxes! Trade Grow''s transparent zero-brokerage delivery and flat pricing structure helps you keep more of your trading profits.',
 'Calculator animation showing ₹19,200 shrinking to ₹0 on delivery.',
 'Stop bleeding profits on unnecessary brokerage fees. #SaveOnBrokerage #TradeGrow',
 'Calculate Your Savings', 'Active Retail Traders', 'BOFU', TRUE, 'PUBLISHED'),

(62, 'Pricing & Charges', 'Zero Brokerage on Equity Delivery: Invest for the long haul for ₹0', 'Buy and hold shares in your demat account with zero brokerage fees forever.', 'Green ₹0 brokerage tag stamped on delivery order confirmation window.', 'Build generational wealth without paying brokerage on delivery investments. #ZeroBrokerage', 'Open Zero Fee Demat', 'Long-term Investors', 'TOFU', TRUE, 'SCHEDULED'),
(63, 'Pricing & Charges', 'Flat ₹20 per executed order on F&O: No hidden percentage surcharges', 'Whether you trade 1 lot or 50 lots, you pay a flat ₹20 per order, never a percentage.', 'Ticket size comparison showing ₹20 flat fee regardless of trade quantity.', 'Predictable, flat-rate pricing for active derivatives traders. #FlatBrokerage', 'View F&O Rates', 'Options Traders', 'MOFU', TRUE, 'SCHEDULED'),
(64, 'Pricing & Charges', 'Demystifying DP (Depository Participant) Charges on Sell Orders', 'What is that ₹13.50 + GST charge when you sell shares from your demat account?', 'Breakdown showing CDSL share vs broker share of DP levy.', 'Clear explanations of every rupee deducted on equity delivery sales. #DPCharges', 'View Pricing Schedule', 'Equity Investors', 'TOFU', TRUE, 'SCHEDULED'),
(65, 'Pricing & Charges', 'Zero Account Maintenance Charges (AMC) for the first year', 'No hidden maintenance deductions eating away at your idle demat portfolio balance.', 'Wallet ledger showing zero quarterly AMC deduction.', 'Start investing without worrying about recurring account maintenance fees. #ZeroAMC', 'Get Free First Year AMC', 'First-Time Traders', 'BOFU', TRUE, 'SCHEDULED'),
(66, 'Pricing & Charges', 'Securities Transaction Tax (STT) Explained: Why buyers and sellers pay it', 'How the central government levies STT on equity delivery and F&O turnover.', 'STT formula calculation card dynamically updating with trade value.', 'Understand statutory taxes on your stock transactions. #STT #GovtLevies', 'Check STT Rates', 'All Traders', 'TOFU', TRUE, 'SCHEDULED'),
(67, 'Pricing & Charges', 'Auto-Square Off Charges: How to avoid the ₹50 call-and-trade penalty', 'If you don''t exit intraday MIS orders before 3:15 PM, RMS automatically closes them with a fee. Set an alarm or use CNC.', 'Clock showing 3:14 PM with automated reminder notification to square off.', 'Save ₹50 per order by closing intraday positions yourself before 3:15 PM. #SmartTrading', 'Read RMS Rules', 'Intraday Traders', 'MOFU', TRUE, 'SCHEDULED'),
(68, 'Pricing & Charges', 'Exchange Turnover Fees: NSE vs BSE rate comparison', 'Exchange transaction charges broken down per crore of turnover.', 'Side-by-side comparison table of NSE and BSE transaction fees.', 'We pass through exchange fees at exact actuals with zero markup. #TrueCost', 'Compare Exchange Fees', 'Institutional Traders', 'MOFU', TRUE, 'SCHEDULED'),
(69, 'Pricing & Charges', 'Zero Deposit Fees: Instant UPI fund transfers with 0% gateway markup', 'Add funds to your virtual or live trading wallet via UPI without paying payment gateway fees.', 'UPI app instant approval confirmation into Trade Grow wallet.', 'Add funds seamlessly with zero convenience charges or hidden gateway fees. #FreeFundTransfer', 'Add Funds via UPI', 'Active Traders', 'BOFU', TRUE, 'SCHEDULED'),
(70, 'Pricing & Charges', 'Instant Withdrawal Engine: Your funds back in your verified bank account', 'Request withdrawals during banking hours and see funds credited via IMPS/NEFT without hassle.', 'Withdrawal request timeline showing verified payout in 2 hours.', 'Your money, accessible whenever you need it. Fast, transparent withdrawals. #FastPayouts', 'Test Withdrawal Speed', 'All Users', 'MOFU', TRUE, 'SCHEDULED'),
(71, 'Pricing & Charges', 'Stamp Duty across Indian States: How domicile affects your trade charges', 'Stamp duty is uniform for equity delivery at 0.015% and F&O at 0.003% under Finance Act.', 'Map of India displaying unified stamp duty rates.', 'Statutory stamp duty schedule explained in simple language. #StampDuty', 'View Stamp Schedule', 'Investors', 'TOFU', TRUE, 'SCHEDULED'),
(72, 'Pricing & Charges', 'Goods and Services Tax (GST) on Brokerage & Exchange Levies', '18% GST applies strictly to brokerage and transaction fees, never on your trade capital.', 'Tax invoice highlighting 18% GST applied strictly to fee subtotal.', 'Clear tax invoices that simplify your input tax credit accounting. #GSTIndia', 'Verify Tax Invoice', 'Business Traders', 'MOFU', TRUE, 'SCHEDULED'),
(73, 'Pricing & Charges', 'SEBI Turnover Charges: ₹10 per crore explained', 'SEBI regulatory levy breakdown and why it is collected from market participants.', 'Miniature calculation showing ₹0.001 per ₹1,000 turnover.', 'Microscopic regulatory charges explained with complete transparency. #SEBILevy', 'View Fee Breakdown', 'Traders', 'TOFU', TRUE, 'SCHEDULED'),
(74, 'Pricing & Charges', 'No Annual Software License or Charting Subscription Fees', 'Access professional candlestick charts, indicators, and market depth without monthly subscriptions.', 'TradingView charts running inside Trade Grow marked "Included at ₹0".', 'Save thousands on third-party charting tools. Professional charts included free. #FreeCharting', 'Launch Free Charts', 'Technical Analysts', 'TOFU', TRUE, 'SCHEDULED'),
(75, 'Pricing & Charges', 'The Transparent Brokerage Pledge: Zero Hidden Line Items', 'Read our published charges schedule. If you find an unlisted charge, we refund it tenfold.', 'Public seal of transparency with link to public pricing schedule.', 'Transparent, fair, and audited brokerage fees you can verify anytime. #TradeGrowPledge', 'Read Transparency Pledge', 'Public', 'TOFU', TRUE, 'PUBLISHED'),

-- ============================================================================
-- PILLAR 5: TRADER PSYCHOLOGY & RISK MANAGEMENT (IDs 76 - 85)
-- ============================================================================
(76, 'Trader Psychology',
 'The revenge trade: How a ₹500 loss turns into a ₹15,000 wipeout',
 'You take a small loss. Your ego gets hurt. You double your position size on a zero-day-to-expiry strike trying to recover it before 3:30 PM. Sound familiar? Trade Grow''s automated RMS risk monitor allows you to set daily loss limits that lock your account before emotion ruins your capital.',
 'Emotional trader vs disciplined trader using automated risk guardrails.',
 'Protect yourself from emotional trading. Set your risk boundaries. #TradingPsychology #RiskFirst',
 'Set Daily Risk Guardrails', 'F&O Traders', 'MOFU', TRUE, 'PUBLISHED'),

(77, 'Trader Psychology', 'Position Sizing: Why no single trade should ever risk more than 2% of capital', 'If you risk 2% per trade, you can survive 50 consecutive losses without blowing your account.', 'Risk-of-ruin chart showing 2% risk survival curve vs 20% risk destruction.', 'Survive first, profit second. Master the 2% position sizing rule. #PositionSizing', 'Calculate Your Lot Size', 'Active Traders', 'MOFU', TRUE, 'SCHEDULED'),
(78, 'Trader Psychology', 'The FOMO Trap: Why buying at the top of a green candle usually ends in pain', 'When a stock has already rallied 8%, retail traders buy out of fear of missing out right into institutional profit-taking.', 'Chart showing retail FOMO entry at the exact peak before mean reversion.', 'Discipline means letting trades go when you missed the entry trigger. #FOMO #TradingDiscipline', 'Learn High-Probability Entries', 'Retail Traders', 'TOFU', TRUE, 'SCHEDULED'),
(79, 'Trader Psychology', 'The Gambler''s Fallacy in Trading: "It has fallen so much, it must bounce now"', 'A stock that drops 90% is a stock that dropped 80% and then got cut in half again.', 'Downtrend chart showing multiple false bottom traps.', 'Never catch falling knives without confirmed technical reversal structures. #RiskManagement', 'Analyze Trend Reversals', 'Beginners', 'TOFU', TRUE, 'SCHEDULED'),
(80, 'Trader Psychology', 'Over-Trading: How trading 40 times a day enriches your broker and drains you', 'More trades do not equal more profit. High frequency creates fatigue, mistakes, and excessive statutory turnover taxes.', 'Comparison of 2 high-conviction trades vs 35 random scalps.', 'Quality over quantity. Trade only your high-conviction A+ setups. #TradingMindset', 'Track Your Trade Count', 'Scalpers', 'MOFU', TRUE, 'SCHEDULED'),
(81, 'Trader Psychology', 'Why taking a trading break after a losing streak is the ultimate edge', 'When your headspace is clouded by frustration, stepping away from the screen preserves both mental clarity and capital.', 'Trader closing laptop and taking a walk in nature.', 'The best trade is sometimes the one you don''t take. Protect your mental capital. #MentalEdge', 'Learn Trading Psychology', 'All Traders', 'TOFU', TRUE, 'SCHEDULED'),
(82, 'Trader Psychology', 'The Myth of 100% Win Rate: Why 50% win rate can make you consistently profitable', 'With a 1:2 risk-to-reward ratio, even losing 5 out of 10 trades yields net positive gains.', 'Mathematical matrix showing 5 wins at +₹2,000 vs 5 losses at -₹1,000 = +₹5,000 profit.', 'You don''t need to be right all the time. You need asymmetric risk-reward. #RiskReward', 'Calculate Your Risk-Reward', 'Intermediate Traders', 'MOFU', TRUE, 'SCHEDULED'),
(83, 'Trader Psychology', 'Moving your Stop Loss to Breakeven too quickly: Why trades get stopped out prematurely', 'Give your trade room to breathe before moving your stop to breakeven, or normal market noise will take you out before the rally.', 'Chart showing price retracing slightly above breakeven before surging 10%.', 'Balance risk protection with trade breathing room. #TradeManagement', 'Master Stop Management', 'Swing Traders', 'MOFU', TRUE, 'SCHEDULED'),
(84, 'Trader Psychology', 'The Illusion of Easy Money in F&O Trading', 'Social media screenshots of lakhs in profits hide the months of losses and high leverage risks.', 'Behind the scenes: showing risk management discipline required behind every real win.', 'Real trading is a skill, not a lottery ticket. Approach the market with respect. #RealTrading', 'Start with Paper Trading', 'Aspiring Traders', 'TOFU', TRUE, 'SCHEDULED'),
(85, 'Trader Psychology', 'Building a Daily Trading Routine: Pre-market checklist to post-market debrief', 'Professional traders do 80% of their work before 9:15 AM and after 3:30 PM.', 'Checklist graphic: Global cues -> Key levels -> Position sizing -> Journal entry.', 'Consistency comes from process, not lucky guesses. Build your trading routine. #TradingRoutine', 'Get Free Pre-Market Checklist', 'Serious Traders', 'TOFU', TRUE, 'SCHEDULED'),

-- ============================================================================
-- PILLAR 6: RETARGETING, KYC RECOVERY & ACTIVATION (IDs 86 - 95)
-- ============================================================================
(86, 'KYC Recovery',
 'Did you get stuck on your Aadhaar OTP during Trade Grow onboarding?',
 'If your mobile number linked to Aadhaar was busy or you didn''t receive the OTP, don''t worry. Your progress is saved. Tap below to resume your 3-minute paperless KYC and unlock your Trade Grow account today.',
 'Mobile screen showing 1-tap "Resume Application" button with instant DigiLocker checkmark.',
 'Your Trade Grow account is 2 clicks away from activation. #PaperlessKYC #TradeGrow',
 'Resume KYC Application', 'KYC Abandoners', 'BOFU', TRUE, 'PUBLISHED'),

(87, 'Activation',
 'Your Trade Grow account is approved! Here is what to do next',
 'Congratulations! Your account is officially verified and approved. Log in right now to explore the live trading terminal, set up your watchlist, and take your first platform walkthrough with zero pressure.',
 'Quick celebratory welcome screen moving into clean terminal interface.',
 'Welcome to Trade Grow. Your verified trading journey begins now. #AccountReady',
 'Log In to Terminal', 'Approved Non-Activated Users', 'BOFU', TRUE, 'PUBLISHED'),

(88, 'Referral Growth',
 'Know a trader who hates high brokerage? Refer them to Trade Grow',
 'Share your unique referral link with your trading network. When they complete KYC and execute their first trade, you earn ₹250 in verified brokerage credits, and they get premium terminal features.',
 'User sharing link on WhatsApp -> Friend activating -> Referral bonus credited.',
 'Share transparent trading with your network and earn referral credits. #ReferAndEarn',
 'Get Your Referral Link', 'Activated Users', 'BOFU', TRUE, 'PUBLISHED'),

(89, 'KYC Recovery', 'Bank Penny Drop failed? Here is how to fix it in 30 seconds', 'Ensure your bank account is in your own name as per your PAN card.', 'Simple 3-step prompt showing how to re-enter IFSC and account number.', 'Fix your bank verification instantly and complete account opening. #KYCHelp', 'Fix Bank Verification', 'Stuck Onboarding Users', 'BOFU', TRUE, 'SCHEDULED'),
(90, 'KYC Recovery', 'Aadhaar Mobile Link Guide: Update your number at any Post Office or CSC', 'If your Aadhaar is linked to an old number, here is how to quickly update it.', 'Locator map highlighting nearby Aadhaar Seva Kendras.', 'Get your Aadhaar OTP working to unlock paperless digital investing. #AadhaarHelp', 'Find Aadhaar Kendra', 'Aadhaar Stuck Users', 'BOFU', TRUE, 'SCHEDULED'),
(91, 'Activation', 'How to place your very first simulated order in under 60 seconds', 'Step-by-step walkthrough: Select Reliance -> Click Buy -> Enter 1 Share -> View Confirmation.', 'Screen recording showing 1-share buy order completing in demo mode.', 'Place your first risk-free practice trade right now. #FirstTrade #DemoMode', 'Place First Practice Trade', 'Approved Users', 'BOFU', TRUE, 'SCHEDULED'),
(92, 'Activation', 'Weekend Market Simulator: Practice trading even when markets are closed', 'Replay historical market data on weekends to hone your strategy before Monday open.', 'Simulator timeline scrubbing through historical Nifty candle action on a Saturday.', 'Sharpen your trading edge on weekends with our market simulator. #WeekendTrading', 'Launch Weekend Simulator', 'Weekend Learners', 'MOFU', TRUE, 'SCHEDULED'),
(93, 'Activation', 'Set up your default 5-stock watchlist in 10 seconds', 'Pre-populated Nifty 50 watchlist ready for instant monitoring with one tap.', 'User tapping "Add Nifty Top 5" and seeing instant streaming quotes.', 'Customize your daily watchlist and track India''s top companies. #Watchlist', 'Setup Your Watchlist', 'New Activations', 'BOFU', TRUE, 'SCHEDULED'),
(94, 'KYC Recovery', 'Why DigiLocker is the safest way to complete your stockbroker KYC', 'DigiLocker documents are cryptographically signed directly by the issuing authority.', 'Security shield graphic illustrating DigiLocker encrypted document transfer.', 'Safe, government-backed paperless verification with zero physical copies. #DigiLocker', 'Complete DigiLocker KYC', 'Hesitant Leads', 'BOFU', TRUE, 'SCHEDULED'),
(95, 'Activation', 'Fund your Trade Grow wallet with ₹1,000 to unlock live market data feeds', 'Add initial trading capital via instant UPI and start exploring live market depth.', 'UPI notification confirming ₹1,000 credit into virtual trading balance.', 'Start small, learn the mechanics, and grow your trading confidence. #FirstDeposit', 'Fund Wallet via UPI', 'Registered Users', 'BOFU', TRUE, 'SCHEDULED'),

-- ============================================================================
-- PILLAR 7: REFERRAL & COMMUNITY GROWTH (IDs 96 - 100)
-- ============================================================================
(96, 'Community & Referral',
 'How Raghav earned ₹2,500 in trading credits by inviting his college finance club',
 'Raghav shared Trade Grow with 10 classmates who wanted to practice simulated trading. As they completed verification and placed their first trades, Raghav earned verified credits toward his account.',
 'Student trader looking at referral dashboard with 10 completed referral credits.',
 'Empower your friends with transparent trading tools and get rewarded. #CampusAmbassador',
 'Share Your Referral Link', 'College & Young Traders', 'BOFU', TRUE, 'SCHEDULED'),

(97, 'Community & Referral', 'Join our Verified Trader Community on WhatsApp & Discord', 'Connect with disciplined traders, share chart setups, and discuss market structure in a spam-free environment.', 'Community chat preview with annotated chart analysis and zero stock tipping.', 'A community focused on skill, risk management, and trading mastery. #TradingCommunity', 'Join Trader Community', 'Active Users', 'TOFU', TRUE, 'SCHEDULED'),
(98, 'Community & Referral', 'Trade Grow Creator Partner Program: Grow your financial audience with us', 'Are you a SEBI-registered analyst or financial educator? Partner with Trade Grow to offer your audience clean terminal infrastructure.', 'Creator dashboard showing custom affiliate link analytics and conversion stats.', 'Partner with an ethical, transparent brokerage platform. #FinTechCreator', 'Apply as Creator Partner', 'Financial Creators', 'TOFU', TRUE, 'SCHEDULED'),
(99, 'Community & Referral', 'Monthly Paper Trading Leaderboard: Compete for recognition with zero risk', 'Top 10 disciplined traders on our virtual terminal get highlighted on our monthly leaderboards.', 'Leaderboard UI showcasing top virtual traders ranked by risk-adjusted Sharpe ratio.', 'Test your trading skill against peers with zero financial risk. #TradingLeaderboard', 'Join Monthly Challenge', 'Competitive Traders', 'MOFU', TRUE, 'SCHEDULED'),
(100, 'Community & Referral',
 'The Trade Grow 1,000 Users Milestone: Thank you for building the future of trading with us',
 'We set out on a 90-day mission to build India''s most transparent, high-performance trading platform for 1,000 genuine active traders. Every feature, from our zero-lag WebSockets to our transparent fees, was built for you.',
 'Montage of platform features, trader feedback, and live milestone counter ticking past 1,000.',
 'Thank you for being part of our founding 1,000 active traders community. #TradeGrowFoundingMembers',
 'Join the 1,000 Founders Club', 'All Audiences', 'BOFU', TRUE, 'SCHEDULED')
ON CONFLICT (idea_index) DO NOTHING;
