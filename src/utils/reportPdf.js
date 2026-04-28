import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN_X = 54;
const PDF_MARGIN_TOP = 58;
const PDF_MARGIN_BOTTOM = 42;
const PDF_LINE_HEIGHT = 14;

const PDF_TEXT_REPLACEMENTS = [
  [/\u2018|\u2019|\u2032/g, "'"],
  [/\u201C|\u201D|\u2033/g, '"'],
  [/\u2013|\u2014/g, '-'],
  [/\u2022/g, '-'],
  [/\u2026/g, '...'],
  [/\u00A0/g, ' ']
];

function normalizePdfText(value) {
  const source = value === null || value === undefined ? '' : String(value);
  let normalized = typeof source.normalize === 'function' ? source.normalize('NFKD') : source;
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  PDF_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });
  return normalized
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function escapePdfText(value) {
  return normalizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function estimateTextWidth(text, fontSize) {
  const source = normalizePdfText(text);
  const averageWidth = fontSize * 0.52;
  return Array.from(source).reduce((total, character) => {
    if (character === ' ') return total + averageWidth * 0.33;
    if (/[.,:;'"`|!]/.test(character)) return total + averageWidth * 0.45;
    if (/[ilI1\[\]\(\)]/.test(character)) return total + averageWidth * 0.56;
    if (/[mwMW@#%&]/.test(character)) return total + averageWidth * 1.45;
    if (/[A-Z]/.test(character)) return total + averageWidth * 1.08;
    return total + averageWidth;
  }, 0);
}

function splitLongToken(token, fontSize, maxWidth) {
  const safeToken = normalizePdfText(token);
  const chunkSize = Math.max(Math.floor(maxWidth / (fontSize * 0.62)), 10);
  const chunks = [];
  for (let index = 0; index < safeToken.length; index += chunkSize) {
    chunks.push(safeToken.slice(index, index + chunkSize));
  }
  return chunks;
}

function wrapText(text, { fontSize = 11, maxWidth }) {
  const paragraphs = normalizePdfText(text).split('\n');
  const wrapped = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const cleanParagraph = paragraph.trim();
    if (!cleanParagraph) {
      if (paragraphIndex > 0) {
        wrapped.push('');
      }
      return;
    }

    const words = cleanParagraph.split(/\s+/).flatMap((token) => {
      if (estimateTextWidth(token, fontSize) <= maxWidth) return [token];
      return splitLongToken(token, fontSize, maxWidth);
    });

    let currentLine = '';

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (!currentLine || estimateTextWidth(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        return;
      }

      wrapped.push(currentLine);
      currentLine = word;
    });

    if (currentLine) {
      wrapped.push(currentLine);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      wrapped.push('');
    }
  });

  return wrapped.length > 0 ? wrapped : [''];
}

function formatGeneratedAt(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }
  return normalizePdfText(value);
}

function sanitizeFilename(value) {
  return normalizePdfText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'case';
}

function buildDefaultReportFilename(filename, caseLabel) {
  return filename || `CLC_Inspection_Report_${sanitizeFilename(caseLabel || 'case')}.pdf`;
}

async function waitForReportAssets(element) {
  if (!element) return;

  if (element.ownerDocument?.fonts?.ready) {
    try {
      await element.ownerDocument.fonts.ready;
    } catch {
      // Ignore font readiness failures and continue with best-effort capture.
    }
  }

  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const finalize = () => {
            image.removeEventListener('load', finalize);
            image.removeEventListener('error', finalize);
            resolve();
          };

          image.addEventListener('load', finalize, { once: true });
          image.addEventListener('error', finalize, { once: true });
        })
    )
  );
}

export async function exportStyledInspectionReportPdf({
  element,
  filename = '',
  caseLabel = ''
}) {
  if (!(element instanceof HTMLElement)) {
    throw new Error('A rendered report element is required for styled PDF export.');
  }

  await waitForReportAssets(element);

  const viewportScale =
    typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
  const captureScale = Math.max(2, Math.min(viewportScale, 3));
  const sourceWidth = Math.max(element.scrollWidth, element.clientWidth, element.offsetWidth);

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scale: captureScale,
    windowWidth: Math.max(element.scrollWidth, element.ownerDocument?.documentElement?.clientWidth || 0),
    onclone: (clonedDocument) => {
      const clonedRoot = clonedDocument.querySelector('[data-report-export-root="true"]');
      if (!clonedRoot) return;

      clonedRoot.style.width = `${sourceWidth}px`;
      clonedRoot.style.maxWidth = `${sourceWidth}px`;
      clonedRoot.style.margin = '0';
      clonedRoot.style.border = 'none';
      clonedRoot.style.borderRadius = '0';
      clonedRoot.style.boxShadow = 'none';
      clonedRoot.style.background = '#ffffff';

      clonedDocument.body.style.margin = '0';
      clonedDocument.body.style.background = '#ffffff';

      clonedRoot.querySelectorAll('button, .add-action-row, .tooltip-text').forEach((node) => {
        node.remove();
      });

      clonedRoot.querySelectorAll('[contenteditable="true"]').forEach((node) => {
        node.setAttribute('contenteditable', 'false');
        node.style.outline = 'none';
        node.style.boxShadow = 'none';
        node.style.background = 'transparent';
      });
    }
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;
  const renderedImageHeight = (canvas.height * printableWidth) / canvas.width;
  const imageData = canvas.toDataURL('image/png');
  let heightRemaining = renderedImageHeight;
  let yOffset = margin;

  pdf.addImage(imageData, 'PNG', margin, yOffset, printableWidth, renderedImageHeight, undefined, 'FAST');
  heightRemaining -= printableHeight;

  while (heightRemaining > 0) {
    pdf.addPage();
    yOffset = margin - (renderedImageHeight - heightRemaining - margin);
    pdf.addImage(imageData, 'PNG', margin, yOffset, printableWidth, renderedImageHeight, undefined, 'FAST');
    heightRemaining -= printableHeight;
  }

  return {
    blob: pdf.output('blob'),
    filename: buildDefaultReportFilename(filename, caseLabel)
  };
}

function createPage() {
  return {
    y: PDF_PAGE_HEIGHT - PDF_MARGIN_TOP,
    operations: []
  };
}

function addTextOperation(page, text, { x, y, font = 'F1', size = 11 }) {
  page.operations.push(
    `BT\n/${font} ${size} Tf\n1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${escapePdfText(text)}) Tj\nET`
  );
}

function addRuleOperation(page, y) {
  page.operations.push(
    `0.6 w\n${PDF_MARGIN_X.toFixed(2)} ${y.toFixed(2)} m\n${(PDF_PAGE_WIDTH - PDF_MARGIN_X).toFixed(2)} ${y.toFixed(2)} l\nS`
  );
}

function buildPdfDocument(pageStreams) {
  const objects = [];

  const reserveObject = () => {
    objects.push('');
    return objects.length;
  };

  const setObject = (reference, body) => {
    objects[reference - 1] = body;
  };

  const fontRegularRef = reserveObject();
  const fontBoldRef = reserveObject();
  const fontItalicRef = reserveObject();
  const pageRefs = [];
  const contentRefs = [];

  pageStreams.forEach((stream) => {
    const contentRef = reserveObject();
    const pageRef = reserveObject();
    contentRefs.push(contentRef);
    pageRefs.push(pageRef);
    setObject(contentRef, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const pagesRef = reserveObject();
  const catalogRef = reserveObject();

  setObject(fontRegularRef, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  setObject(fontBoldRef, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  setObject(fontItalicRef, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');

  pageRefs.forEach((pageRef, index) => {
    setObject(
      pageRef,
      `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R /F3 ${fontItalicRef} 0 R >> >> /Contents ${contentRefs[index]} 0 R >>`
    );
  });

  setObject(
    pagesRef,
    `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((reference) => `${reference} 0 R`).join(' ')}] >>`
  );
  setObject(catalogRef, `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

  let pdf = '%PDF-1.4\n% CLC report\n';
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function createInspectionReportPdf({
  title = 'Council for Licensed Conveyancers',
  subtitle = 'Inspection Report',
  caseMeta = {},
  summaryLines = [],
  sections = [],
  generatedAt = new Date(),
  filename = ''
}) {
  const pages = [createPage()];
  let currentPage = pages[0];

  const ensureSpace = (requiredHeight = PDF_LINE_HEIGHT) => {
    if (currentPage.y - requiredHeight < PDF_MARGIN_BOTTOM) {
      currentPage = createPage();
      pages.push(currentPage);
    }
  };

  const moveDown = (amount) => {
    ensureSpace(amount);
    currentPage.y -= amount;
  };

  const writeWrappedLine = (
    text,
    {
      font = 'F1',
      size = 11,
      indent = 0,
      continuationIndent = indent,
      bullet = '',
      leading = PDF_LINE_HEIGHT,
      beforeGap = 0,
      afterGap = 0
    } = {}
  ) => {
    if (beforeGap > 0) {
      moveDown(beforeGap);
    }

    const bulletPrefix = bullet ? `${bullet} ` : '';
    const bulletWidth = bullet ? 12 : 0;
    const firstLineMaxWidth = PDF_PAGE_WIDTH - (PDF_MARGIN_X * 2) - indent - bulletWidth;
    const continuationMaxWidth = PDF_PAGE_WIDTH - (PDF_MARGIN_X * 2) - continuationIndent - bulletWidth;
    const paragraphs = normalizePdfText(text).split('\n');

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const wrapped = wrapText(paragraph, {
        fontSize: size,
        maxWidth: paragraphIndex === 0 ? firstLineMaxWidth : continuationMaxWidth
      });

      wrapped.forEach((line, lineIndex) => {
        ensureSpace(leading);
        const isFirstVisibleLine = paragraphIndex === 0 && lineIndex === 0;
        const textX = PDF_MARGIN_X + (isFirstVisibleLine ? indent : continuationIndent) + (isFirstVisibleLine ? 0 : bulletWidth);
        const content = isFirstVisibleLine ? `${bulletPrefix}${line}`.trimEnd() : line;
        addTextOperation(currentPage, content, { x: textX, y: currentPage.y, font, size });
        currentPage.y -= leading;
      });

      if (paragraphIndex < paragraphs.length - 1) {
        currentPage.y -= 4;
      }
    });

    if (afterGap > 0) {
      currentPage.y -= afterGap;
    }
  };

  const writeCenteredLine = (text, { font = 'F1', size = 12, afterGap = 0 } = {}) => {
    ensureSpace(PDF_LINE_HEIGHT + afterGap);
    const normalized = normalizePdfText(text);
    const width = estimateTextWidth(normalized, size);
    const x = Math.max(PDF_MARGIN_X, (PDF_PAGE_WIDTH - width) / 2);
    addTextOperation(currentPage, normalized, { x, y: currentPage.y, font, size });
    currentPage.y -= PDF_LINE_HEIGHT + afterGap;
  };

  const writeSectionHeading = (heading) => {
    ensureSpace(PDF_LINE_HEIGHT * 2);
    moveDown(6);
    writeWrappedLine(heading, { font: 'F2', size: 13, afterGap: 4 });
  };

  writeCenteredLine(title, { font: 'F2', size: 18, afterGap: 2 });
  writeCenteredLine(subtitle, { font: 'F1', size: 12, afterGap: 6 });
  addRuleOperation(currentPage, currentPage.y);
  moveDown(18);

  writeSectionHeading('Case Details');
  [
    ['Practice', caseMeta.practiceName],
    ['Licence', caseMeta.caseId],
    ['Inspector', caseMeta.inspector],
    ['Inspection date', caseMeta.inspectionDate || caseMeta.started],
    ['Inspection type', caseMeta.inspectionType],
    ['HoLP', caseMeta.holp],
    ['HoFA', caseMeta.hofa],
    ['Generated', formatGeneratedAt(generatedAt)]
  ]
    .filter(([, value]) => normalizePdfText(value).trim())
    .forEach(([label, value]) => {
      writeWrappedLine(`${label}: ${value}`, { size: 11, afterGap: 2 });
    });

  if (summaryLines.length > 0) {
    writeSectionHeading('Compliance Snapshot');
    summaryLines.forEach((line) => {
      writeWrappedLine(line, { size: 11, bullet: '-', indent: 10, continuationIndent: 22, afterGap: 2 });
    });
  }

  sections.forEach((section) => {
    const sectionLines = Array.isArray(section?.lines)
      ? section.lines.map((line) => normalizePdfText(line).trim()).filter(Boolean)
      : [];
    if (!section?.heading || sectionLines.length === 0) {
      return;
    }

    writeSectionHeading(section.heading);
    sectionLines.forEach((line) => {
      writeWrappedLine(line, {
        size: 11,
        bullet: section.bulleted ? '-' : '',
        indent: section.bulleted ? 10 : 0,
        continuationIndent: section.bulleted ? 22 : 0,
        afterGap: 2
      });
    });
  });

  const totalPages = pages.length;
  pages.forEach((page, index) => {
    addRuleOperation(page, 32);
    addTextOperation(page, `Page ${index + 1} of ${totalPages}`, {
      x: PDF_PAGE_WIDTH - PDF_MARGIN_X - 58,
      y: 18,
      font: 'F1',
      size: 9
    });
  });

  const pageStreams = pages.map((page) => page.operations.join('\n'));
  const blob = buildPdfDocument(pageStreams);
  const resolvedFilename = buildDefaultReportFilename(filename, caseMeta.caseId || caseMeta.practiceName);

  return {
    blob,
    filename: resolvedFilename
  };
}
