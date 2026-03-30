import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { StockTransfer } from '@/types/stock.types';

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  billing_address: string;
  shipping_address: string;
  customer_gstin?: string;
  company_gstin?: string;
  legal_name?: string;
  sub_total: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  grand_total: number;
  items: Array<{
    product_code: string;
    product_name: string;
    hsn_code?: string;
    quantity_boxes: number;
    unit_price: number;
    taxable_amount: number;
    gst_rate: number;
    line_total: number;
  }>;
}

export const generateInvoicePDF = (data: InvoiceData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header - Company Info
  doc.setFontSize(20);
  doc.text(data.legal_name || 'TILES WMS', 14, 22);
  doc.setFontSize(10);
  doc.text(`GSTIN: ${data.company_gstin || 'N/A'}`, 14, 30);
  
  doc.setFontSize(16);
  doc.text('TAX INVOICE', pageWidth - 14, 22, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`Invoice #: ${data.invoice_number}`, pageWidth - 14, 30, { align: 'right' });
  doc.text(`Date: ${format(new Date(data.invoice_date), 'dd-MMM-yyyy')}`, pageWidth - 14, 35, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(14, 40, pageWidth - 14, 40);

  // Bill To / Ship To
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, 50);
  doc.text('Ship To:', (pageWidth / 2) + 7, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(data.customer_name, 14, 55);
  doc.text(data.billing_address || '—', 14, 60, { maxWidth: (pageWidth / 2) - 21 });
  if (data.customer_gstin) {
    doc.text(`GSTIN: ${data.customer_gstin}`, 14, 75);
  }

  doc.text(data.customer_name, (pageWidth / 2) + 7, 55);
  doc.text(data.shipping_address || '—', (pageWidth / 2) + 7, 60, { maxWidth: (pageWidth / 2) - 21 });

  // Items Table
  autoTable(doc, {
    startY: 85,
    head: [['#', 'Item Desciption', 'HSN', 'Qty (Boxes)', 'Rate', 'Taxable Amt', 'GST %', 'Total']],
    body: data.items.map((it, idx) => [
      idx + 1,
      `${it.product_code} - ${it.product_name}`,
      it.hsn_code || '—',
      it.quantity_boxes,
      `INR ${it.unit_price.toLocaleString()}`,
      `INR ${it.taxable_amount.toLocaleString()}`,
      `${it.gst_rate}%`,
      `INR ${it.line_total.toLocaleString()}`
    ]),
    foot: [
        ['', '', '', '', '', 'Sub Total', '', `INR ${data.sub_total.toLocaleString()}`],
        ['', '', '', '', '', 'CGST', '', `INR ${data.cgst_amount.toLocaleString()}`],
        ['', '', '', '', '', 'SGST', '', `INR ${data.sgst_amount.toLocaleString()}`],
        ['', '', '', '', '', 'IGST', '', `INR ${data.igst_amount.toLocaleString()}`],
        ['', '', '', '', '', 'Grand Total', '', `INR ${data.grand_total.toLocaleString()}`]
    ],
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 60 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' }
    }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.text('Notes: This is a computer generated invoice and does not require a physical signature.', 14, finalY);

  doc.save(`${data.invoice_number}.pdf`);
};

// ─── Stock Transfer Challan ───────────────────────────────────────────────────

export const generateTransferChallanPDF = ({
  transfer,
  fromWarehouseName,
  toWarehouseName,
}: {
  transfer: StockTransfer;
  fromWarehouseName: string;
  toWarehouseName: string;
}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('STOCK TRANSFER CHALLAN', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Transfer No: ${transfer.transfer_number}`, 14, 30);
  doc.text(
    `Date: ${format(new Date(transfer.transfer_date), 'dd-MMM-yyyy')}`,
    pageWidth - 14,
    30,
    { align: 'right' }
  );
  doc.text(`Status: ${transfer.status.replace('_', ' ').toUpperCase()}`, pageWidth - 14, 36, {
    align: 'right',
  });

  doc.setLineWidth(0.4);
  doc.line(14, 40, pageWidth - 14, 40);

  // From / To warehouses
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('From Warehouse:', 14, 50);
  doc.text('To Warehouse:', pageWidth / 2 + 7, 50);

  doc.setFont('helvetica', 'normal');
  doc.text(fromWarehouseName, 14, 56);
  doc.text(toWarehouseName, pageWidth / 2 + 7, 56);

  if (transfer.vehicle_number) {
    doc.text(`Vehicle No: ${transfer.vehicle_number}`, 14, 63);
  }

  // Items table
  autoTable(doc, {
    startY: transfer.vehicle_number ? 70 : 65,
    head: [['#', 'Product Name', 'SKU / Code', 'Transferred (Boxes)', 'Received (Boxes)']],
    body: (transfer.items ?? []).map((item, idx) => [
      idx + 1,
      item.product_name ?? item.product_id,
      item.product_code ?? '—',
      item.transferred_boxes,
      transfer.status === 'received' ? (item.received_boxes ?? 0) : '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 100, 180], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10 },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  if (transfer.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 14, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.notes, 14, finalY + 5, { maxWidth: pageWidth - 28 });
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  const signY = doc.internal.pageSize.getHeight() - 20;
  doc.line(14, signY, 70, signY);
  doc.line(pageWidth - 70, signY, pageWidth - 14, signY);
  doc.text('Dispatched By', 14, signY + 5);
  doc.text('Received By', pageWidth - 70, signY + 5);

  doc.save(`${transfer.transfer_number}.pdf`);
};
