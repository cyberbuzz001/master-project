/**
 * Cross-platform UPI deep linking and Android intent dispatcher.
 * Prevents mobile browsers (like Android Chrome / iOS Safari) from
 * auto-opening WhatsApp Pay when tapping UPI payment buttons.
 */

export interface UpiPaymentDetails {
  upiId: string;
  merchantName: string;
  amount: number;
  note?: string;
}

export type SupportedUpiApp = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'whatsapp' | 'generic';

export function getUpiAppDeepLink(app: SupportedUpiApp, details: UpiPaymentDetails): string {
  const { upiId, merchantName, amount, note = 'Trade Grow Margin Deposit' } = details;
  const pa = encodeURIComponent(upiId.trim());
  const pn = encodeURIComponent(merchantName.trim());
  const am = Math.max(1, amount).toFixed(2);
  const tn = encodeURIComponent(note.trim());

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  const genericUpiUri = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;

  switch (app) {
    case 'phonepe':
      if (isAndroid) {
        return `intent://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR#Intent;scheme=upi;package=com.phonepe.app;end`;
      }
      if (isIOS) {
        return `phonepe://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;
      }
      return genericUpiUri;

    case 'gpay':
      if (isAndroid) {
        return `intent://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
      }
      if (isIOS) {
        return `tez://upi/pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;
      }
      return genericUpiUri;

    case 'paytm':
      if (isAndroid) {
        return `intent://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR#Intent;scheme=upi;package=net.one97.paytm;end`;
      }
      if (isIOS) {
        return `paytmmp://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;
      }
      return genericUpiUri;

    case 'bhim':
      if (isAndroid) {
        return `intent://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR#Intent;scheme=upi;package=in.org.npci.upiapp;end`;
      }
      if (isIOS) {
        return `bhim://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;
      }
      return genericUpiUri;

    case 'whatsapp':
      if (isAndroid) {
        return `intent://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR#Intent;scheme=upi;package=com.whatsapp;end`;
      }
      if (isIOS) {
        return `whatsapp://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&cu=INR`;
      }
      return genericUpiUri;

    case 'generic':
    default:
      return genericUpiUri;
  }
}

/**
 * Directly trigger the chosen UPI application on mobile devices.
 */
export function launchUpiApp(app: SupportedUpiApp, details: UpiPaymentDetails) {
  const url = getUpiAppDeepLink(app, details);
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}
