'use strict';

const PDFDocument = require('pdfkit');

function escapePdf(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Build a PDF of submissions and resolve with a Buffer. */
function buildSubmissionsPdf(rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text('PodStream Honeypot — Captured Records', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`Generated: ${new Date().toISOString()}  ·  Total records: ${rows.length}`, { align: 'center' });
    doc.moveDown(1.2);

    if (!rows.length) {
      doc.fontSize(12).fillColor('#333').text('No records captured yet.', { align: 'center' });
      doc.end();
      return;
    }

    // Table
    const headers = ['#', 'Username', 'Password', 'IP', 'Country', 'City', 'Method', 'Time (UTC)'];
    const widths = [40, 180, 180, 110, 100, 100, 80, 150];
    const startX = doc.page.margins.left;
    let y = doc.y;
    const rowHeight = 18;
    const pageHeight = doc.page.height - doc.page.margins.bottom;

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
      let x = startX;
      headers.forEach((h, i) => {
        doc.rect(x, y, widths[i], rowHeight).fill('#1d1d1f');
        doc.fillColor('#fff').text(h, x + 4, y + 5, { width: widths[i] - 8 });
        x += widths[i];
      });
      y += rowHeight;
    }

    function ensureSpace() {
      if (y + rowHeight > pageHeight) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
    }

    drawHeader();

    rows.forEach((r) => {
      ensureSpace();
      doc.font('Helvetica').fontSize(8.5);
      const cells = [
        String(r.id),
        escapePdf(r.username),
        escapePdf(r.password),
        escapePdf(r.ip),
        escapePdf(r.country),
        escapePdf(r.city),
        escapePdf(r.method),
        escapePdf(r.created_at),
      ];
      let x = startX;
      cells.forEach((c, i) => {
        // Alternate row shading
        doc.fillColor(rows.indexOf(r) % 2 === 0 ? '#f7f7f9' : '#ffffff')
          .rect(x, y, widths[i], rowHeight)
          .fill();
        doc.fillColor('#333').text(c, x + 4, y + 5, { width: widths[i] - 8, ellipsis: true });
        x += widths[i];
      });
      y += rowHeight;
    });

    doc.end();
  });
}

module.exports = { buildSubmissionsPdf };
