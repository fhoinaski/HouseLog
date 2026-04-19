import QRCode from 'qrcode';
import { COLOR_PALETTE } from '@/lib/color-palette';

export async function generateQRCodeDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 2,
    color: { dark: COLOR_PALETTE.neutral900, light: COLOR_PALETTE.white },
  });
}
