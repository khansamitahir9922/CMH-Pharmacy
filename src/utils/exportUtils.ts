import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Export data to Excel via main process (avoids renderer binary/base64 issues).
 * Sends data + headers as JSON; main process builds the xlsx and writes the file.
 */
export function exportToExcel(data: Record<string, unknown>[], headers: string[], filename: string): void {
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  window.api.invoke('export:saveExcel', { filename: name, data, headers }).catch(() => {})
}

/**
 * Export data to PDF and trigger save via Electron dialog.
 */
export function exportToPDF(
  data: Record<string, unknown>[],
  headers: string[],
  title: string,
  filename: string
): void {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  const tableData = data.map((row) => headers.map((h) => String(row[h] ?? '')))
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 24,
    styles: { fontSize: 8 }
  })
  const pdfBase64 = doc.output('datauristring').split(',')[1]
  if (!pdfBase64) return
  window.api.invoke('export:savePdf', { filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`, base64: pdfBase64 }).catch(() => {})
}
