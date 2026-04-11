const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const sanitizeHtml = require('sanitize-html');

const stripHtml = (value) =>
  sanitizeHtml(value || '', {
    allowedTags: [],
    allowedAttributes: {}
  }).replace(/\r\n/g, '\n').trim();

const formatDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getDailyNoteColumns = () => [
  { header: 'Date', key: 'date', width: 14, date: true },
  { header: 'Project Name', key: 'project_name', width: 24 },
  { header: 'Task Title', key: 'task_title', width: 28 },
  { header: 'Day Start Description', key: 'day_start_description', width: 42, wrap: true },
  { header: 'Day End Description', key: 'day_end_description', width: 42, wrap: true },
  { header: 'Status', key: 'status', width: 16 },
  { header: 'Remarks', key: 'remarks', width: 28, wrap: true }
];

const getNoteColumns = () => [
  { header: 'Created Date', key: 'createdAt', width: 16, date: true },
  { header: 'Title', key: 'title', width: 28 },
  { header: 'Description', key: 'description', width: 42, wrap: true },
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Priority', key: 'priority', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Updated Date', key: 'updatedAt', width: 16, date: true }
];

const getConfig = (resource) => {
  if (resource === 'notes') {
    return {
      title: 'Notes Report',
      worksheetName: 'Notes',
      columns: getNoteColumns()
    };
  }

  return {
    title: 'Daily Notes Report',
    worksheetName: 'Daily Notes',
    columns: getDailyNoteColumns()
  };
};

const normalizeDailyNotes = (records) =>
  records.map((item) => ({
    date: item.date,
    project_name: item.project_name || '',
    task_title: item.task_title || '',
    day_start_description: stripHtml(item.day_start_description),
    day_end_description: stripHtml(item.day_end_description),
    status: item.status || '',
    remarks: stripHtml(item.remarks)
  }));

const normalizeNotes = (records) =>
  records.map((item) => ({
    createdAt: item.createdAt,
    title: item.title || '',
    description: stripHtml(item.description),
    category: item.category && item.category.name ? item.category.name : 'Uncategorized',
    priority: item.priority || '',
    status: item.status || '',
    updatedAt: item.updatedAt
  }));

const normalizeRows = (records, resource) =>
  resource === 'notes' ? normalizeNotes(records) : normalizeDailyNotes(records);

const escapeCsvValue = (value, isDate = false) => {
  const rawValue = isDate ? formatDate(value) : `${value || ''}`;
  const escaped = rawValue.replace(/"/g, '""');
  return `"${escaped}"`;
};

const collectPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

const drawPdfHeader = (doc, title) => {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1f2937').text(title, 40, 36);
  doc.moveTo(40, 62).lineTo(555, 62).strokeColor('#d1d5db').stroke();
};

const ensurePdfPageSpace = (doc, requiredHeight, title, drawTableHeader) => {
  if (doc.y + requiredHeight <= doc.page.height - 40) {
    return;
  }

  doc.addPage();
  drawPdfHeader(doc, title);
  doc.y = 78;
  drawTableHeader();
};

const fitPdfText = (value, limit = 140) => {
  const text = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 3)}...`;
};

exports.exportToExcel = async (records, resource) => {
  const config = getConfig(resource);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ZenNotes';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(config.worksheetName, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = config.columns;
  sheet.addRows(normalizeRows(records, resource));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }
  };
  headerRow.height = 24;

  config.columns.forEach((column, index) => {
    const worksheetColumn = sheet.getColumn(index + 1);

    if (column.date) {
      worksheetColumn.numFmt = 'dd-mmm-yyyy';
      worksheetColumn.alignment = { vertical: 'top', horizontal: 'left' };
    } else {
      worksheetColumn.alignment = {
        vertical: 'top',
        wrapText: Boolean(column.wrap)
      };
    }

    let maxLength = column.header.length;
    worksheetColumn.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const cellValue = column.date ? formatDate(cell.value) : `${cell.value || ''}`;
      const lines = cellValue.split('\n');
      lines.forEach((line) => {
        maxLength = Math.max(maxLength, line.length);
      });
    });

    worksheetColumn.width = Math.min(Math.max(column.width, maxLength + 2), 50);
  });

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      if (rowNumber > 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowNumber % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' }
        };
      }
    });
  });

  return workbook.xlsx.writeBuffer();
};

exports.exportToCSV = async (records, resource) => {
  const config = getConfig(resource);
  const rows = normalizeRows(records, resource);
  const header = config.columns.map((column) => escapeCsvValue(column.header)).join(',');
  const lines = rows.map((row) =>
    config.columns
      .map((column) => escapeCsvValue(row[column.key], column.date))
      .join(',')
  );

  return Buffer.from([header, ...lines].join('\n'), 'utf8');
};

exports.exportToPDF = async (records, resource) => {
  const config = getConfig(resource);
  const rows = normalizeRows(records, resource);
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true
  });

  const bufferPromise = collectPdfBuffer(doc);
  const columns =
    resource === 'notes'
      ? [
          { header: 'Date', key: 'createdAt', width: 64, date: true },
          { header: 'Title', key: 'title', width: 92 },
          { header: 'Description', key: 'description', width: 155 },
          { header: 'Category', key: 'category', width: 72 },
          { header: 'Priority', key: 'priority', width: 48 },
          { header: 'Status', key: 'status', width: 44 }
        ]
      : [
          { header: 'Date', key: 'date', width: 50, date: true },
          { header: 'Project', key: 'project_name', width: 65 },
          { header: 'Task', key: 'task_title', width: 60 },
          { header: 'Day Start', key: 'day_start_description', width: 95 },
          { header: 'Day End', key: 'day_end_description', width: 95 },
          { header: 'Status', key: 'status', width: 45 },
          { header: 'Remarks', key: 'remarks', width: 55 }
        ];

  doc.info.Title = config.title;
  drawPdfHeader(doc, config.title);
  doc.y = 78;

  const drawTableHeader = () => {
    const startX = 40;
    const startY = doc.y;
    let cursorX = startX;

    doc.rect(startX, startY, columns.reduce((sum, column) => sum + column.width, 0), 22)
      .fillAndStroke('#1F4E78', '#1F4E78');

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    columns.forEach((column) => {
      doc.text(column.header, cursorX + 4, startY + 6, {
        width: column.width - 8,
        align: 'left'
      });
      cursorX += column.width;
    });

    doc.fillColor('#111827').font('Helvetica').fontSize(8);
    doc.y = startY + 26;
  };

  drawTableHeader();

  rows.forEach((row, index) => {
    const cellValues = columns.map((column) =>
      column.date ? formatDate(row[column.key]) : fitPdfText(row[column.key])
    );
    const heights = cellValues.map((value, i) =>
      doc.heightOfString(value, { width: columns[i].width - 8, align: 'left' })
    );
    const rowHeight = Math.max(22, Math.max(...heights) + 8);

    ensurePdfPageSpace(doc, rowHeight + 6, config.title, drawTableHeader);

    const startX = 40;
    const startY = doc.y;
    let cursorX = startX;

    doc.rect(startX, startY, columns.reduce((sum, column) => sum + column.width, 0), rowHeight)
      .fillAndStroke(index % 2 === 0 ? '#F8FAFC' : '#FFFFFF', '#E5E7EB');

    doc.fillColor('#111827').font('Helvetica').fontSize(8);
    columns.forEach((column, columnIndex) => {
      doc.text(cellValues[columnIndex], cursorX + 4, startY + 4, {
        width: column.width - 8,
        height: rowHeight - 8
      });
      cursorX += column.width;
    });

    doc.y = startY + rowHeight + 6;
  });

  doc.end();
  return bufferPromise;
};
