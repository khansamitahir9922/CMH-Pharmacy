import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Export data to Excel and trigger save via Electron dialog.
 */
export function exportToExcel(data: Record<string, unknown>[], headers: string[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(data, { header: headers })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : ''
  window.api.invoke('export:saveExcel', { filename: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, base64 }).catch(() => {})
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
