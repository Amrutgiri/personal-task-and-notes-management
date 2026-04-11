const DailyNote = require('../models/DailyNote');
const Note = require('../models/Note');
const exportService = require('../services/exportService');
const accessService = require('../services/accessService');

const buildDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return null;
  }

  const range = {};

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    range.$gte = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return Object.keys(range).length > 0 ? range : null;
};

const sanitizeFilenamePart = (value) =>
  `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'report';

const buildDailyNotesQuery = (filters) => {
  const query = {};
  const dateRange = buildDateRange(filters.startDate, filters.endDate);

  if (dateRange) {
    query.date = dateRange;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.projectName) {
    query.project_name = { $regex: filters.projectName, $options: 'i' };
  }

  return query;
};

const buildNotesQuery = (filters) => {
  const query = {};
  const dateRange = buildDateRange(filters.startDate, filters.endDate);

  if (dateRange) {
    query.createdAt = dateRange;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.projectName) {
    query.$or = [
      { title: { $regex: filters.projectName, $options: 'i' } },
      { description: { $regex: filters.projectName, $options: 'i' } }
    ];
  }

  return query;
};

const getExportMeta = (resource, format) => {
  const extensionByFormat = {
    xlsx: 'xlsx',
    csv: 'csv',
    pdf: 'pdf'
  };

  const contentTypeByFormat = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv; charset=utf-8',
    pdf: 'application/pdf'
  };

  return {
    extension: extensionByFormat[format],
    contentType: contentTypeByFormat[format],
    filenameBase: sanitizeFilenamePart(resource)
  };
};

const fetchExportData = async (resource, reqUser, filters) => {
  if (resource === 'notes') {
    return Note.find({
      ...accessService.getVisibleUserFilter(reqUser),
      ...buildNotesQuery(filters)
    })
      .select('title description priority status createdAt updatedAt category')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  return DailyNote.find({
    ...accessService.getVisibleUserFilter(reqUser),
    ...buildDailyNotesQuery(filters)
  })
    .select('date project_name task_title day_start_description day_end_description status remarks')
    .sort({ date: -1, createdAt: -1 })
    .lean();
};

exports.exportData = async (req, res) => {
  try {
    const format = `${req.query.format || 'xlsx'}`.toLowerCase();
    const resource = `${req.query.resource || 'daily-notes'}`.toLowerCase();

    if (!['xlsx', 'csv', 'pdf'].includes(format)) {
      req.flash('error_msg', 'Unsupported export format requested.');
      return res.redirect(req.get('Referrer') || '/daily-notes');
    }

    if (!['daily-notes', 'notes'].includes(resource)) {
      req.flash('error_msg', 'Unsupported export scope requested.');
      return res.redirect(req.get('Referrer') || '/daily-notes');
    }

    const filters = {
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      status: req.query.status || '',
      projectName: req.query.projectName || ''
    };

    const records = await fetchExportData(resource, req.session.user, filters);
    const meta = getExportMeta(resource, format);

    let buffer;
    if (format === 'xlsx') {
      buffer = Buffer.from(await exportService.exportToExcel(records, resource));
    } else if (format === 'csv') {
      buffer = await exportService.exportToCSV(records, resource);
    } else {
      buffer = await exportService.exportToPDF(records, resource);
    }

    const filename = `${meta.filenameBase}-${new Date().toISOString().slice(0, 10)}.${meta.extension}`;
    res.setHeader('Content-Type', meta.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    req.flash('error_msg', 'Failed to export data. Please try again.');

    const fallbackPath = req.query.resource === 'notes' ? '/notes' : '/daily-notes';
    return res.redirect(fallbackPath);
  }
};
