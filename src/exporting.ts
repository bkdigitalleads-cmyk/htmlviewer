/**
 * Getting a file out: the share sheet (Messages, Mail, Save to Files,
 * AirDrop and the rest), Print, and the PDF. Files are made on the phone
 * and go only where the person sends them.
 */
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { shareCopy } from './store';

/** Opens the share sheet for a file already on disk. Resolves when the sheet closes. */
export async function shareFileAt(uri: string, mimeType: string, uti: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle: title });
}

/**
 * Makes the PDF from the page copy (pictures and styles inlined, scripts
 * out) on the phone, and gives it a readable name. Returns its file URL.
 */
export async function makePdf(html: string, name: string, paper: { width: number; height: number }): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, width: paper.width, height: paper.height, margins: { top: 36, right: 36, bottom: 36, left: 36 } });
  return shareCopy(uri, name);
}

/** The system print sheet for the PDF. */
export async function printPdf(uri: string): Promise<void> {
  await Print.printAsync({ uri });
}
