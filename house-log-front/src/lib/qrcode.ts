import QRCode from 'qrcode';

export async function generateQRCodeDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
}
