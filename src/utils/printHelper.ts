export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  elementId?: string;
  htmlContent?: string;
}

export const printReport = ({
  title,
  subtitle,
  orientation = 'landscape',
  elementId,
  htmlContent
}: PrintReportOptions) => {
  let content = htmlContent || '';

  if (!content && elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      // Clone element to avoid modifying live DOM
      const clone = el.cloneNode(true) as HTMLElement;
      
      // Remove elements marked with .no-print
      const noPrints = clone.querySelectorAll('.no-print');
      noPrints.forEach(node => node.remove());

      // Clean up form inputs to plain text or checkmark values
      const inputs = clone.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const inputEl = input as HTMLInputElement;
        const span = document.createElement('span');
        span.textContent = inputEl.value || inputEl.placeholder || '';
        span.className = 'font-bold';
        inputEl.parentNode?.replaceChild(span, inputEl);
      });

      content = clone.innerHTML;
    }
  }

  if (!content) {
    console.error('No content found for printReport');
    window.print();
    return;
  }

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: ${orientation};
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #000000 !important;
            background: #ffffff !important;
            margin: 0;
            padding: 10px;
            font-size: 10px;
            line-height: 1.3;
          }
          .print-header {
            text-align: center;
            margin-bottom: 12px;
            border-bottom: 2px solid #000000;
            padding-bottom: 6px;
          }
          .print-header h1 {
            font-size: 13px;
            font-weight: 900;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .print-header h2 {
            font-size: 11px;
            font-weight: 800;
            margin: 3px 0 0 0;
            text-transform: uppercase;
          }
          .print-header p {
            font-size: 9px;
            font-weight: 600;
            margin: 2px 0 0 0;
            color: #333333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 8px;
            font-size: 9px;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 4px 5px;
            text-align: left;
            color: #000000 !important;
            background-color: #ffffff !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: 800;
            text-align: center;
            text-transform: uppercase;
          }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .font-bold, .font-black { font-weight: 800 !important; }
          .no-print { display: none !important; }
          
          /* Force light background for all text in print */
          p, span, div, td, th, h1, h2, h3, h4, h5, h6 {
            color: #000000 !important;
          }

          .print-footer {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .signature-box {
            width: 28%;
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 5px;
            font-size: 9px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        ${htmlContent ? `
          <div class="print-header">
            <h1>FELDA PLANTATION MANAGEMENT SDN. BHD.</h1>
            <h2>${title}</h2>
            ${subtitle ? `<p>${subtitle}</p>` : ''}
          </div>
          <div>${content}</div>
        ` : content}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print iframe failed, fallback to window.print()', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 300);
};
