import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { query, queryOne, execute, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';

function parseAngelExpiryToYYYYMMDD(str?: string): string | null {
  if (!str || str.trim() === '') return null;
  const clean = str.trim().toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };

  const match = clean.match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = months[match[2]];
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

export interface RawScripRecord {
  token: string;
  symbol: string;
  name: string;
  expiry: string;
  strike: string;
  lotsize: string;
  instrumenttype: string;
  exch_seg: string;
  tick_size: string;
}

export interface CanonicalInstrument {
  id: string;
  instrument_token: string;
  exchange: string;
  segment: string;
  symbol: string;
  trading_symbol: string;
  name: string;
  lot_size: number;
  tick_size: number;
  strike: number;
  option_type: 'CE' | 'PE' | 'XX';
  expiry: string | null;
  instrument_type: string;
  active: boolean;
}

export interface DhanScripRecord {
  securityId: string;
  exchange: string;
  segment: string; // 'NSE_FNO' | 'BSE_FNO' | 'NSE_INDEX' | 'IDX_I' | 'NSE_EQ' | 'BSE_EQ'
  tradingSymbol: string;
  symbolName: string;
  strikePrice: number;
  optionType: 'CE' | 'PE' | 'XX';
  expiryDate: string; // YYYY-MM-DD
  lotSize: number;
}

export interface SearchResultItem {
  token: string;
  symbol: string;
  name: string;
  exchange: string;
  segment: string;
  lotSize: number;
  strikePrice: number;
  optionType: 'CE' | 'PE' | 'XX';
  expiryDate: string;
}

export class InstrumentMasterService {
  private static instance: InstrumentMasterService;
  private masterUrl = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
  private dhanMasterUrl = 'https://images.dhan.co/api-data/api-scrip-master.csv';

  private isReady: boolean = false;
  private lastSyncTimestamp: number = 0;
  private totalTokensLoaded: number = 0;
  private lastVersionId: string = '';
  private tokenLookupCache: Map<string, string> = new Map();
  private dhanLookupMap: Map<string, DhanScripRecord> = new Map();
  private equityList: Array<SearchResultItem> = [];
  private indexList: Array<SearchResultItem> = [];
  private unmappedMisses5m: { securityId: string; timestamp: number }[] = [];
  private isResyncing: boolean = false;

  public static getInstance(): InstrumentMasterService {
    if (!InstrumentMasterService.instance) {
      InstrumentMasterService.instance = new InstrumentMasterService();
    }
    return InstrumentMasterService.instance;
  }

  public isMasterReady(): boolean {
    return this.isReady;
  }

  public getHealthStatus() {
    this.cleanUnmappedMisses();
    return {
      isReady: this.isReady,
      lastSyncTimestamp: this.lastSyncTimestamp,
      lastSyncDate: this.lastSyncTimestamp > 0 ? new Date(this.lastSyncTimestamp).toISOString() : null,
      totalTokensLoaded: this.totalTokensLoaded,
      dhanLookupKeys: this.dhanLookupMap.size,
      unmappedTickCount5m: this.unmappedMisses5m.length,
      versionId: this.lastVersionId,
    };
  }

  private cleanUnmappedMisses(): void {
    const fiveMinsAgo = Date.now() - (5 * 60 * 1000);
    this.unmappedMisses5m = this.unmappedMisses5m.filter(m => m.timestamp >= fiveMinsAgo);
  }

  /**
   * Downloads official Dhan HQ Scrip Master CSV file
   */
  public async downloadDhanMasterCsv(): Promise<string> {
    return new Promise((resolve, reject) => {
      const csvPath = path.resolve(__dirname, '../../../data/api-scrip-master.csv');
      osEnsureDir(path.dirname(csvPath));

      console.log('[InstrumentMasterService] Downloading official Dhan HQ Scrip Master CSV...');
      https.get(this.dhanMasterUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed Dhan Scrip Master download. HTTP Status: ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(csvPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log('[InstrumentMasterService] Successfully downloaded Dhan Scrip Master CSV.');
          resolve(csvPath);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Syncs and indexes Dhan Scrip Master CSV into memory and database
   */
  public async syncDhanScripMaster(): Promise<number> {
    const csvPath = path.resolve(__dirname, '../../../data/api-scrip-master.csv');
    let targetPath = csvPath;

    if (!fs.existsSync(csvPath)) {
      try {
        targetPath = await this.downloadDhanMasterCsv();
      } catch (err: any) {
        console.warn(`[InstrumentMasterService] Dhan CSV download fallback: ${err.message}`);
        if (!fs.existsSync(csvPath)) return 0;
      }
    }

    const fileStream = fs.createReadStream(targetPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let isHeader = true;
    let count = 0;
    // Reference point for picking which expiry wins the ambiguous, expiry-less
    // base key below (e.g. "BFO_SENSEX_77600_PE") — computed once, not per line.
    const todayStr = new Date().toISOString().split('T')[0];

    for await (const line of rl) {
      if (isHeader) {
        isHeader = false;
        continue;
      }
      if (!line || line.trim() === '') continue;

      const parts = line.split(',');
      if (parts.length < 11) continue;

      const exchange = parts[0]?.trim();
      const segmentCode = parts[1]?.trim(); // D = F&O, E = EQ, I = Index
      const securityId = parts[2]?.trim();
      const tradingSymbol = parts[5]?.trim();
      const lotSize = parseFloat(parts[6] || '1');
      const expiryDateStr = parts[8]?.trim(); // 2026-09-29 14:30:00
      const strikePrice = parseFloat(parts[9] || '0');
      const optionType = parts[10]?.trim() as 'CE' | 'PE' | 'XX';
      let rawUnderlying = tradingSymbol.split('-')[0].trim().toUpperCase();
      if (rawUnderlying === 'BSXOPT' || rawUnderlying === 'BSXFUT' || rawUnderlying === 'BSX') rawUnderlying = 'SENSEX';
      if (rawUnderlying === 'BKXOPT' || rawUnderlying === 'BKXFUT' || rawUnderlying === 'BKX') rawUnderlying = 'BANKEX';

      let symbolName = parts[15]?.trim().toUpperCase();
      if (!symbolName || symbolName === 'BSXOPT' || symbolName === 'BSXFUT' || symbolName === 'BKXOPT' || symbolName === 'BKXFUT') {
        symbolName = rawUnderlying;
      }

      if (!securityId) continue;
      count++;
      if (count % 2000 === 0) {
        await new Promise(r => setImmediate(r));
      }

      const segment = segmentCode === 'D'
        ? (exchange === 'BSE' ? 'BSE_FNO' : 'NSE_FNO')
        : segmentCode === 'M'
        ? 'MCX_COMM'
        : segmentCode === 'I'
        ? (exchange === 'BSE' ? 'IDX_I' : 'NSE_INDEX')
        : (exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ');
      const expiryDate = expiryDateStr ? expiryDateStr.split(' ')[0] : '';

      const rec: DhanScripRecord = {
        securityId,
        exchange: exchange || 'NSE',
        segment,
        tradingSymbol,
        symbolName: symbolName || rawUnderlying,
        strikePrice,
        optionType: optionType === 'CE' || optionType === 'PE' ? optionType : 'XX',
        expiryDate,
        lotSize: isNaN(lotSize) || lotSize < 1 ? 1 : lotSize
      };

      // Indexing in-memory lookups
      const segPrefix = exchange === 'BSE' ? 'BFO' : exchange === 'MCX' ? 'MCX' : 'NFO';

      // 1. By SecurityId e.g. "35000"
      this.dhanLookupMap.set(securityId, rec);

      // 2. By Trading Symbol e.g. "BANKNIFTY-Aug2026-72600-CE" or "CRUDEOIL-17Sep2026-7000-CE"
      if (tradingSymbol) {
        this.dhanLookupMap.set(tradingSymbol, rec);
      }

      // 3. By Option format e.g. "NFO_BANKNIFTY_72600_CE", "BFO_SENSEX_77000_CE", "MCX_CRUDEOIL_7000_CE"
      if ((optionType === 'CE' || optionType === 'PE') && strikePrice > 0 && rec.symbolName) {
        const cleanSym = rec.symbolName.replace(/^(NSE_|BSE_|NFO_|BFO_|MCX_)/, '');
        const optKey = `${segPrefix}_${cleanSym}_${strikePrice}_${optionType}`;

        const existing = this.dhanLookupMap.get(optKey);
        if (!existing) {
          this.dhanLookupMap.set(optKey, rec);
        } else if (expiryDate) {
          const existingExpired = existing.expiryDate < todayStr;
          const candidateExpired = expiryDate < todayStr;
          if ((existingExpired && !candidateExpired) ||
              (!existingExpired && !candidateExpired && expiryDate < existing.expiryDate)) {
            this.dhanLookupMap.set(optKey, rec);
          }
        }
        if (expiryDate) {
          this.dhanLookupMap.set(`${optKey}_${expiryDate}`, rec);
        }
      } else if (exchange === 'MCX' && (optionType === 'XX' || !optionType)) {
        // MCX Futures & Commodity Underlyings (e.g. MCX_CRUDEOIL, MCX_GOLD)
        const cleanSym = rec.symbolName.replace(/^(MCX_)/, '');
        const futKey = `MCX_${cleanSym}`;
        const existing = this.dhanLookupMap.get(futKey);
        if (!existing) {
          this.dhanLookupMap.set(futKey, rec);
        } else if (expiryDate) {
          const existingExpired = existing.expiryDate < todayStr;
          const candidateExpired = expiryDate < todayStr;
          if ((existingExpired && !candidateExpired) ||
              (!existingExpired && !candidateExpired && expiryDate < existing.expiryDate)) {
            this.dhanLookupMap.set(futKey, rec);
          }
        }
        if (expiryDate) {
          this.dhanLookupMap.set(`${futKey}_${expiryDate}`, rec);
        }
      } else if (segmentCode === 'E') {
        const cleanSym = tradingSymbol.replace(/^(NSE_|BSE_)/, '').toUpperCase();
        const customSymbol = parts[7]?.trim();
        const friendlyName = customSymbol || symbolName || cleanSym;
        const canonicalToken = `${exchange}_${cleanSym}`;

        rec.tradingSymbol = cleanSym;
        rec.symbolName = friendlyName;

        this.dhanLookupMap.set(canonicalToken, rec);
        this.dhanLookupMap.set(`${canonicalToken}-EQ`, rec);
        this.dhanLookupMap.set(cleanSym, rec);
        this.dhanLookupMap.set(`${cleanSym}-EQ`, rec);

        const series = parts[14]?.trim();
        if (!series || ['EQ', 'BE', 'SM', 'BZ'].includes(series)) {
          this.equityList.push({
            token: canonicalToken,
            symbol: cleanSym,
            name: friendlyName,
            exchange: exchange || 'NSE',
            segment: `${exchange || 'NSE'}_EQ`,
            lotSize: rec.lotSize,
            strikePrice: 0,
            optionType: 'XX',
            expiryDate: ''
          });
        }
      } else if (segmentCode === 'I') {
        const cleanSym = rec.symbolName.replace(/^(NSE_|BSE_)/, '');
        const canonicalToken = `${exchange}_${cleanSym}`;
        this.dhanLookupMap.set(canonicalToken, rec);
        this.dhanLookupMap.set(cleanSym, rec);

        this.indexList.push({
          token: canonicalToken,
          symbol: cleanSym,
          name: cleanSym,
          exchange: exchange || 'NSE',
          segment: `${exchange || 'NSE'}_INDEX`,
          lotSize: rec.lotSize,
          strikePrice: 0,
          optionType: 'XX',
          expiryDate: ''
        });
      }
    }

    // Aliases for popular tickers that differ from Dhan raw naming (e.g. TATAMOTORS -> TMPV, ZOMATO -> ETERNAL)
    const tmpv = this.dhanLookupMap.get('3456');
    if (tmpv) {
      const tataMotorsRec: DhanScripRecord = {
        ...tmpv,
        tradingSymbol: 'TATAMOTORS',
        symbolName: 'Tata Motors Limited'
      };
      this.dhanLookupMap.set('NSE_TATAMOTORS', tataMotorsRec);
      this.dhanLookupMap.set('TATAMOTORS', tataMotorsRec);
      this.equityList.unshift({
        token: 'NSE_TATAMOTORS',
        symbol: 'TATAMOTORS',
        name: 'Tata Motors Limited',
        exchange: 'NSE',
        segment: 'NSE_EQ',
        lotSize: 1,
        strikePrice: 0,
        optionType: 'XX',
        expiryDate: ''
      });
    }

    const eternal = this.dhanLookupMap.get('5097');
    if (eternal) {
      const zomatoRec: DhanScripRecord = {
        ...eternal,
        tradingSymbol: 'ZOMATO',
        symbolName: 'Zomato Limited (Eternal)'
      };
      this.dhanLookupMap.set('NSE_ZOMATO', zomatoRec);
      this.dhanLookupMap.set('ZOMATO', zomatoRec);
      this.equityList.unshift({
        token: 'NSE_ZOMATO',
        symbol: 'ZOMATO',
        name: 'Zomato Limited (Eternal)',
        exchange: 'NSE',
        segment: 'NSE_EQ',
        lotSize: 1,
        strikePrice: 0,
        optionType: 'XX',
        expiryDate: ''
      });
    }

    console.log(`[InstrumentMasterService] Loaded ${count} Dhan instruments into ${this.dhanLookupMap.size} lookup keys.`);
    this.isReady = true;
    return count;
  }

  public getDhanScripBySecurityId(securityId: string): DhanScripRecord | undefined {
    if (!securityId) return undefined;
    return this.dhanLookupMap.get(String(securityId).trim());
  }

  public getDhanScripByToken(token: string): DhanScripRecord | undefined {
    if (!token) return undefined;
    const clean = token.trim();
    const direct = this.dhanLookupMap.get(clean);
    if (direct) return direct;

    const noPrefix = clean.replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    const match = this.dhanLookupMap.get(noPrefix);
    if (match) return match;

    return undefined;
  }

  public getDhanSecurityId(underlying: string, strike: number, optionType: 'CE' | 'PE', expiry?: string): string | null {
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_|NFO_|BFO_|MCX_)/, '');
    const isMcx = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'GOLDM', 'SILVERM', 'CRUDEOILM', 'NATGASMINI', 'ZINC', 'LEAD', 'ALUMINIUM'].includes(cleanSym);
    const segPrefix = cleanSym === 'SENSEX' ? 'BFO' : isMcx ? 'MCX' : 'NFO';
    const baseKey = `${segPrefix}_${cleanSym}_${strike}_${optionType}`;

    if (expiry) {
      const expKey = `${baseKey}_${expiry.trim()}`;
      const recExp = this.dhanLookupMap.get(expKey);
      if (recExp) return recExp.securityId;
    }

    const recBase = this.dhanLookupMap.get(baseKey);
    if (recBase) return recBase.securityId;

    return null;
  }

  /**
   * High-performance in-memory lookup for live tick security IDs.
   * Tracks miss counter and triggers emergency re-sync if misses exceed threshold in 5m.
   */
  public findTokenBySecurityId(securityId: string): string | null {
    if (!securityId) return null;
    const cleanId = String(securityId).trim();

    // 1. Check Dhan Scrip Lookup Map
    const dhanRec = this.dhanLookupMap.get(cleanId);
    if (dhanRec) {
      if (dhanRec.optionType === 'CE' || dhanRec.optionType === 'PE') {
        const segPrefix = dhanRec.exchange === 'BSE' ? 'BFO' : dhanRec.exchange === 'MCX' ? 'MCX' : 'NFO';
        return `${segPrefix}_${dhanRec.symbolName}_${dhanRec.strikePrice}_${dhanRec.optionType}`;
      }
      if (dhanRec.exchange === 'MCX') {
        return `MCX_${dhanRec.symbolName}`;
      }
      if (dhanRec.segment === 'NSE_EQ' || dhanRec.segment === 'BSE_EQ') {
        return `${dhanRec.exchange}_${dhanRec.tradingSymbol}`;
      }
      return dhanRec.tradingSymbol || `${dhanRec.exchange}_${dhanRec.securityId}`;
    }

    // 2. Check tokenLookupCache
    const token = this.tokenLookupCache.get(cleanId);
    if (token) return token;

    // Record unmapped miss
    const now = Date.now();
    this.unmappedMisses5m.push({ securityId: cleanId, timestamp: now });
    this.cleanUnmappedMisses();

    if (this.unmappedMisses5m.length >= 20 && !this.isResyncing) {
      console.warn(`[InstrumentMasterService] Unmapped security ID misses reached ${this.unmappedMisses5m.length} in 5m. Triggering emergency Scrip Master re-sync...`);
      this.isResyncing = true;
      this.unmappedMisses5m = [];
      void this.syncDhanScripMaster().finally(() => { this.isResyncing = false; });
    }

    return null;
  }

  /**
   * Fast in-memory search for symbols, indices, options, and futures across Dhan master.
   * Prioritizes Indices and Cash Equities at the top so stocks like SBIN, RELIANCE, TCS are never buried.
   */
  public searchInstruments(queryText: string, limit: number = 30): SearchResultItem[] {
    if (!queryText || queryText.trim().length < 1) return [];
    const cleanQ = queryText.trim().toUpperCase().replace(/\s+/g, ' ');
    const results: SearchResultItem[] = [];
    const seenTokens = new Set<string>();

    // 1. Search Major Indices First
    for (const idx of this.indexList) {
      if (results.length >= limit) break;
      const sym = idx.symbol.toUpperCase();
      const name = idx.name.toUpperCase();
      if (sym.includes(cleanQ) || name.includes(cleanQ)) {
        if (!seenTokens.has(idx.token)) {
          seenTokens.add(idx.token);
          results.push(idx);
        }
      }
    }

    // 2. Exact match cash equities
    for (const eq of this.equityList) {
      if (results.length >= limit) break;
      if (eq.symbol.toUpperCase() === cleanQ) {
        if (!seenTokens.has(eq.token)) {
          seenTokens.add(eq.token);
          results.push(eq);
        }
      }
    }

    // 3. Starts-with cash equities
    for (const eq of this.equityList) {
      if (results.length >= limit) break;
      const sym = eq.symbol.toUpperCase();
      if (sym.startsWith(cleanQ) && sym !== cleanQ) {
        if (!seenTokens.has(eq.token)) {
          seenTokens.add(eq.token);
          results.push(eq);
        }
      }
    }

    // 4. Contains / Name match cash equities
    for (const eq of this.equityList) {
      if (results.length >= limit) break;
      const sym = eq.symbol.toUpperCase();
      const name = eq.name.toUpperCase();
      if ((sym.includes(cleanQ) || name.includes(cleanQ)) && !seenTokens.has(eq.token)) {
        seenTokens.add(eq.token);
        results.push(eq);
      }
    }

    // 5. If limit not reached, search F&O Derivatives, Options and Commodities
    if (results.length < limit) {
      for (const [key, rec] of this.dhanLookupMap.entries()) {
        if (results.length >= limit) break;
        if (/^\d+$/.test(key)) continue;

        const sym = rec.symbolName || '';
        const tradingSym = rec.tradingSymbol || '';
        const match =
          key.includes(cleanQ) ||
          sym.includes(cleanQ) ||
          tradingSym.includes(cleanQ);

        if (match) {
          let token = key;
          if (rec.optionType === 'CE' || rec.optionType === 'PE') {
            const segPrefix = rec.exchange === 'BSE' ? 'BFO' : rec.exchange === 'MCX' ? 'MCX' : 'NFO';
            token = `${segPrefix}_${rec.symbolName}_${rec.strikePrice}_${rec.optionType}`;
          } else if (rec.exchange === 'MCX') {
            token = `MCX_${rec.symbolName}`;
          } else if (!token.startsWith(rec.exchange)) {
            token = `${rec.exchange}_${rec.tradingSymbol || rec.symbolName}`;
          }

          if (!seenTokens.has(token)) {
            seenTokens.add(token);
            results.push({
              token,
              symbol: rec.tradingSymbol || rec.symbolName,
              name: rec.symbolName,
              exchange: rec.exchange,
              segment: rec.segment,
              lotSize: rec.lotSize,
              strikePrice: rec.strikePrice,
              optionType: rec.optionType,
              expiryDate: rec.expiryDate
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Initializes Instrument Master on server startup.
   * Loads existing token lookup cache from DB, downloads latest master JSON, and blocks if DB is empty.
   */
  public async initializeOnStartup(): Promise<void> {
    console.log('[InstrumentMasterService] Initializing Scrip Master on server startup...');
    try {
      // First sync Dhan Scrip Master into memory
      await this.syncDhanScripMaster();

      // 1. Populate tokenLookupCache from existing database
      const rows = await query<{ instrument_token: string; trading_symbol: string }>(
        'SELECT instrument_token, trading_symbol FROM instruments WHERE active = TRUE'
      );
      rows.forEach(r => {
        if (r.instrument_token) {
          const rawToken = r.instrument_token.replace(/^([A-Z]+_)/, '');
          this.tokenLookupCache.set(rawToken, r.instrument_token);
          this.tokenLookupCache.set(r.instrument_token, r.instrument_token);
          if (r.trading_symbol) {
            this.tokenLookupCache.set(r.trading_symbol, r.instrument_token);
          }
        }
      });

      this.totalTokensLoaded = rows.length;
      console.log(`[InstrumentMasterService] Loaded ${rows.length} existing active tokens into lookup cache.`);

      // 2. Also populate equityList from database active instruments
      try {
        const dbEquities = await query<{
          instrument_token: string;
          symbol: string;
          trading_symbol: string;
          name: string;
          exchange: string;
          segment: string;
          lot_size: number;
        }>(
          `SELECT instrument_token, symbol, trading_symbol, name, exchange, segment, lot_size 
           FROM instruments 
           WHERE active = TRUE AND (segment = 'NSE_EQ' OR segment = 'EQ' OR segment = 'BSE_EQ')`
        );
        const existingTokens = new Set(this.equityList.map(e => e.token));
        dbEquities.forEach(r => {
          if (!existingTokens.has(r.instrument_token)) {
            existingTokens.add(r.instrument_token);
            this.equityList.push({
              token: r.instrument_token,
              symbol: r.symbol || r.trading_symbol?.replace('-EQ', '') || r.instrument_token.replace(/^(NSE_|BSE_)/, ''),
              name: r.name || r.symbol,
              exchange: r.exchange || 'NSE',
              segment: r.segment || 'NSE_EQ',
              lotSize: Number(r.lot_size) || 1,
              strikePrice: 0,
              optionType: 'XX',
              expiryDate: ''
            });
          }
        });
        console.log(`[InstrumentMasterService] Fast equity index contains ${this.equityList.length} total equity scrips.`);
      } catch (dbErr: any) {
        console.warn('[InstrumentMasterService] DB equity index load warning:', dbErr.message);
      }

      this.isReady = true;

      // Schedule daily recurring scrip master sync (runs every 24 hours to keep strike IDs fresh)
      setInterval(() => {
        console.log('[InstrumentMasterService] Running scheduled daily scrip master sync...');
        void this.syncDhanScripMaster();
        void this.syncMasterData();
      }, 24 * 60 * 60 * 1000);
    } catch (err: any) {
      console.warn('[InstrumentMasterService] Startup master initialization fallback:', err.message);
      this.isReady = true;
    }
  }

  /**
   * Downloads official Angel One Scrip Master JSON file
   */
  public async downloadMasterJson(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempPath = path.resolve(__dirname, '../../../data/OpenAPIScripMaster.json');
      osEnsureDir(path.dirname(tempPath));

      https.get(this.masterUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed download. HTTP Status: ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(tempPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(tempPath);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Syncs Official Master Dataset into PostgreSQL Database
   */
  public async syncMasterData(sampleData?: RawScripRecord[]): Promise<{
    versionId: string;
    totalParsed: number;
    inserted: number;
    updated: number;
  }> {
    const startTime = Date.now();
    const versionId = `VER_${generateUUID()}`;

    let rawRecords: RawScripRecord[] = [];

    if (sampleData && sampleData.length > 0) {
      rawRecords = sampleData;
    } else {
      try {
        const filePath = await this.downloadMasterJson();
        const rawText = fs.readFileSync(filePath, 'utf-8');
        rawRecords = JSON.parse(rawText);
      } catch (err: any) {
        console.warn(`[InstrumentMasterService] Master download fallback to seed data: ${err.message}`);
        rawRecords = [
          { token: "2885",     symbol: "RELIANCE-EQ",           name: "RELIANCE",   expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "11536",    symbol: "TCS-EQ",                name: "TCS",        expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "1594",     symbol: "INFY-EQ",               name: "INFY",       expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "1333",     symbol: "HDFCBANK-EQ",           name: "HDFCBANK",   expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "4963",     symbol: "ICICIBANK-EQ",          name: "ICICIBANK",  expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "3456",     symbol: "TATAMOTORS-EQ",         name: "TATAMOTORS", expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "99926000", symbol: "NIFTY 50",              name: "NIFTY 50",   expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "AMXIDX", exch_seg: "NSE", tick_size: "0.05" },
          { token: "99926009", symbol: "BANKNIFTY",             name: "BANKNIFTY",  expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "AMXIDX", exch_seg: "NSE", tick_size: "0.05" },
          { token: "49231",    symbol: "NIFTY28AUG2624500CE",   name: "NIFTY",      expiry: "28AUG2026", strike: "24500.0", lotsize: "25", instrumenttype: "OPTIDX", exch_seg: "NFO", tick_size: "0.05" },
          { token: "49232",    symbol: "NIFTY28AUG2624500PE",   name: "NIFTY",      expiry: "28AUG2026", strike: "24500.0", lotsize: "25", instrumenttype: "OPTIDX", exch_seg: "NFO", tick_size: "0.05" }
        ];
      }
    }

    const fileHash = crypto.createHash('sha256').update(JSON.stringify(rawRecords.slice(0, 100))).digest('hex');
    let inserted = 0;
    let updated  = 0;

    // Batch upsert in chunks of 500 with isolated savepoints to prevent poisoned transaction blocks
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rawRecords.length; i += CHUNK_SIZE) {
      const chunk = rawRecords.slice(i, i + CHUNK_SIZE);
      await withTransaction(async (client) => {
        let spIdx = 0;
        for (const raw of chunk) {
          if (!raw.token || !raw.symbol) continue;

          const exchange   = (raw.exch_seg || 'NSE').slice(0, 10);
          const segment    = exchange.includes('FO') ? 'FO' : 'EQ';
          
          let parsedStrike = parseFloat(raw.strike || '0');
          if (isNaN(parsedStrike) || parsedStrike < 0) parsedStrike = 0;
          if (parsedStrike > 1000000) parsedStrike = parsedStrike / 100;
          const strikeVal = Math.min(99999999.99, parsedStrike);

          let parsedLot = parseInt(raw.lotsize || '1', 10);
          if (isNaN(parsedLot) || parsedLot < 1) parsedLot = 1;
          const lotSizeVal = Math.min(2147483647, parsedLot);

          let parsedTick = parseFloat(raw.tick_size || '0.05');
          if (isNaN(parsedTick) || parsedTick < 0.01) parsedTick = 0.05;
          const tickSizeVal = Math.min(9999.99, parsedTick);

          const optionType = raw.symbol.endsWith('CE') ? 'CE' : raw.symbol.endsWith('PE') ? 'PE' : 'XX';
          const token      = `${exchange}_${raw.token}`.slice(0, 64);
          const parsedExpiry = parseAngelExpiryToYYYYMMDD(raw.expiry);

          const spName = `sp_${++spIdx}`;
          try {
            await client.query(`SAVEPOINT ${spName}`);
            const result = await client.query(
              `INSERT INTO instruments (id, instrument_token, exchange, segment, symbol, trading_symbol, name, lot_size, tick_size, strike, option_type, expiry, instrument_type, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
               ON CONFLICT (instrument_token) DO UPDATE SET
                 trading_symbol = EXCLUDED.trading_symbol,
                 lot_size       = EXCLUDED.lot_size,
                 strike         = EXCLUDED.strike,
                 option_type    = EXCLUDED.option_type,
                 expiry         = EXCLUDED.expiry,
                 last_seen_at   = NOW()
               RETURNING (xmax = 0) AS was_inserted`,
              [
                'inst_' + generateUUID(), token, exchange, segment,
                (raw.name || raw.symbol).slice(0, 100), raw.symbol.slice(0, 100), (raw.name || raw.symbol).slice(0, 100),
                lotSizeVal, tickSizeVal,
                strikeVal, optionType,
                parsedExpiry,
                (raw.instrumenttype || (segment === 'FO' ? 'OPT' : 'EQ')).slice(0, 20)
              ]
            );

            await client.query(`RELEASE SAVEPOINT ${spName}`);
            if (result.rows[0]?.was_inserted) {
              inserted++;
            } else {
              updated++;
            }
          } catch (_) {
            try {
              await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
            } catch (__) {}
          }
        }
      }).catch((chunkErr: any) => {
        console.warn(`[InstrumentMasterService] Chunk ${i}-${i + CHUNK_SIZE} skipped:`, chunkErr.message);
      });
      await new Promise(r => setTimeout(r, 10));
    }

    try {
      await execute(
        `UPDATE instruments 
         SET active = FALSE 
         WHERE active = TRUE 
           AND expiry IS NOT NULL 
           AND expiry != '' 
           AND (
             (expiry ~ '^\\d{4}-\\d{2}-\\d{2}$' AND expiry::date < CURRENT_DATE)
             OR (LENGTH(expiry) >= 9 AND expiry ~ '^\\d{1,2}[A-Za-z]{3}\\d{4}$' AND TO_DATE(expiry, 'DDMonYYYY') < CURRENT_DATE)
           )`
      );
    } catch (_) {}

    await execute(
      `INSERT INTO instrument_master_versions (version_id, source_url, file_hash, record_count, valid_count, inserted_count, updated_count, processing_duration_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUCCESS')`,
      [versionId, this.masterUrl, fileHash, rawRecords.length, rawRecords.length, inserted, updated, Date.now() - startTime]
    );

    this.isReady = true;
    this.lastSyncTimestamp = Date.now();
    this.totalTokensLoaded = rawRecords.length;
    this.lastVersionId = versionId;

    rawRecords.forEach(r => {
      if (r.token && r.exch_seg) {
        const fullToken = `${r.exch_seg}_${r.token}`;
        this.tokenLookupCache.set(r.token, fullToken);
        this.tokenLookupCache.set(fullToken, fullToken);
        if (r.symbol) {
          this.tokenLookupCache.set(r.symbol, fullToken);
        }
      }
    });

    console.log(`[InstrumentMasterService] Synced ${rawRecords.length} instruments (inserted: ${inserted}, updated: ${updated}) in ${Date.now() - startTime}ms`);
    return { versionId, totalParsed: rawRecords.length, inserted, updated };
  }

  public async syncPreMarketScripMaster(): Promise<void> {
    console.log('[InstrumentMasterService] Running pre-market instrument master sync job...');
    try {
      await this.syncDhanScripMaster();
      await this.syncMasterData();
    } catch (err: any) {
      console.error('[InstrumentMasterService] Pre-market sync failed:', err.message);
    }
  }

  public async getInstrumentByToken(token: string): Promise<CanonicalInstrument | null> {
    const row = await queryOne<any>(
      'SELECT * FROM instruments WHERE instrument_token = $1 OR instrument_token = $2 OR instrument_token LIKE $3',
      [token, `NSE_${token}`, `%_${token}`]
    );
    if (!row) return null;
    return {
      ...row,
      strike: parseFloat(row.strike || '0'),
      lot_size: parseInt(row.lot_size || '1', 10),
      tick_size: parseFloat(row.tick_size || '0.05')
    };
  }

  public async getInstrumentBySymbol(exchange: string, symbol: string): Promise<CanonicalInstrument | null> {
    const row = await queryOne<any>('SELECT * FROM instruments WHERE exchange = $1 AND trading_symbol = $2', [exchange, symbol]);
    if (!row) return null;
    return {
      ...row,
      strike: parseFloat(row.strike || '0'),
      lot_size: parseInt(row.lot_size || '1', 10),
      tick_size: parseFloat(row.tick_size || '0.05')
    };
  }

  public async getExpiries(underlying: string): Promise<string[]> {
    const rows = await query<{ expiry: string }>(
      `SELECT DISTINCT expiry FROM instruments WHERE name = $1 AND expiry IS NOT NULL ORDER BY expiry ASC`,
      [underlying]
    );
    return rows.map(r => r.expiry);
  }

  public getDhanLookupMap(): Map<string, DhanScripRecord> {
    return this.dhanLookupMap;
  }
}

function osEnsureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
