const DailyNote = require('../models/DailyNote');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const googleSheetsService = require('../services/googleSheetsService');

// ... (existing exports)

// @desc    Sync daily notes to Google Sheets
// @route   POST /daily-notes/sync
exports.syncToGoogleSheets = async (req, res) => {
  try {
    const user_id = req.session.user._id;
    const user = await User.findById(user_id);

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.googleSpreadsheetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please set your Google Spreadsheet ID in settings before syncing.' 
      });
    }

    // Only sync records where is_synced = false
    let query = { user: user_id, is_synced: false };
    if (req.body.startDate && req.body.endDate && req.body.startDate !== '' && req.body.endDate !== '') {
      query.date = { 
        $gte: new Date(req.body.startDate).setHours(0,0,0,0), 
        $lte: new Date(req.body.endDate).setHours(23,59,59,999) 
      };
    }

    const notes = await DailyNote.find(query).lean();

    if (notes.length === 0) {
      return res.json({ success: true, message: 'All records for this period are already synced.', summary: { synced: 0, skipped: 0 } });
    }

    const summary = await googleSheetsService.syncNotes(user, notes);

    // Update is_synced status in database for newly synced notes
    if (summary.synced > 0) {
      const syncedIds = notes.slice(0, summary.synced).map(n => n._id);
      await DailyNote.updateMany(
        { _id: { $in: syncedIds } },
        { is_synced: true, synced_at: new Date() }
      );
    }

    return res.json({ 
      success: true, 
      message: `Successfully synced ${summary.synced} notes. ${summary.skipped} duplicates skipped.`,
      summary 
    });
  } catch (err) {
    console.error('Detailed Sync Error:', err);
    // Ensure we return JSON even on error to avoid "Unexpected token <" in frontend
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'An error occurred during synchronization.',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// @desc    Preview import from Google Sheets
// @route   POST /daily-notes/preview-import
exports.previewImportFromGoogleSheets = async (req, res) => {
  try {
    const user_id = req.session.user._id;
    const user = await User.findById(user_id);

    if (!user.googleSpreadsheetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please set your Google Spreadsheet ID in settings before previewing.' 
      });
    }

    const { summary } = await googleSheetsService.getImportPreview(user);
    
    res.json({
      success: true,
      summary
    });
  } catch (err) {
    console.error('Preview Error:', err);
    res.status(500).json({ success: false, message: err.message || 'An error occurred during preview.' });
  }
};

// @desc    Import daily notes from Google Sheets
// @route   POST /daily-notes/import
exports.importFromGoogleSheets = async (req, res) => {
  try {
    const user_id = req.session.user._id;
    const user = await User.findById(user_id);

    if (!user.googleSpreadsheetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please set your Google Spreadsheet ID in settings before importing.' 
      });
    }

    const { validData, summary } = await googleSheetsService.getImportPreview(user);
    let importedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;

    for (const data of validData) {
      try {
        // Duplicate detection: match by user_id, date, project_name, and task_title
        const existing = await DailyNote.findOne({
          user: user_id,
          date: data.date,
          project_name: data.project_name,
          task_title: data.task_title
        });

        if (existing) {
          duplicateCount++;
          // Ensure is_synced is true if it already exists
          if (!existing.is_synced) {
            existing.is_synced = true;
            existing.synced_at = new Date();
            await existing.save();
          }
          continue;
        }

        await DailyNote.create({
          ...data,
          user: user_id
        });
        importedCount++;
      } catch (rowErr) {
        console.error('Error importing specific row:', rowErr.message);
        skippedCount++;
      }
    }

    res.json({
      success: true,
      message: `Import complete.`,
      summary: {
        totalFound: validData.length,
        imported: importedCount,
        duplicates: duplicateCount,
        failed: skippedCount,
        skippedIrregular: summary.skippedRows
      }
    });
  } catch (err) {
    console.error('Import Error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'An error occurred during import.'
    });
  }
};

// @desc    Update Google Sheets settings
// @route   POST /daily-notes/settings
exports.updateSyncSettings = async (req, res) => {
  try {
    const { googleSpreadsheetId, googleSheetName } = req.body;
    await User.findByIdAndUpdate(req.session.user._id, {
      googleSpreadsheetId,
      googleSheetName: googleSheetName || 'Sheet1'
    });
    
    // Update session as well
    req.session.user.googleSpreadsheetId = googleSpreadsheetId;
    req.session.user.googleSheetName = googleSheetName || 'Sheet1';
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};

// @desc    Backfill UIDs to Google Sheet
// @route   POST /daily-notes/backfill-uids
exports.backfillSheetUIDs = async (req, res) => {
  try {
    const user_id = req.session.user._id;
    const user = await User.findById(user_id);

    if (!user.googleSpreadsheetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please set your Google Spreadsheet ID in settings before backfilling.' 
      });
    }

    const result = await googleSheetsService.backfillUIDToSheet(user);
    
    res.json({
      success: true,
      message: `Backfill complete. Updated ${result.updated} of ${result.total} entries with UIDs.`,
      summary: result
    });
  } catch (err) {
    console.error('Backfill Error:', err);
    res.status(500).json({ success: false, message: err.message || 'An error occurred during backfill.' });
  }
};

// @desc    Get all daily notes (with filtering and pagination)
// @route   GET /daily-notes
exports.getDailyNotes = async (req, res) => {
  try {
    const user_id = req.session.user._id;
    let query = { user: user_id };

    // Filtering by date range/predefined filters
    const filter = req.query.filter || 'all';
    const now = new Date();
    
    if (filter === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const endOfDay = new Date(now.setHours(23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === 'week') {
      const first = now.getDate() - now.getDay();
      const last = first + 6;
      const firstDay = new Date(new Date().setDate(first)).setHours(0, 0, 0, 0);
      const lastDay = new Date(new Date().setDate(last)).setHours(23, 59, 59, 999);
      query.date = { $gte: firstDay, $lte: lastDay };
    } else if (filter === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).setHours(0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).setHours(23, 59, 59, 999);
      query.date = { $gte: firstDay, $lte: lastDay };
    } else if (filter === 'all') {
      // No date query needed
    }

    // Custom date range
    if (req.query.startDate && req.query.endDate && req.query.startDate !== '' && req.query.endDate !== '') {
      query.date = { 
        $gte: new Date(req.query.startDate).setHours(0,0,0,0), 
        $lte: new Date(req.query.endDate).setHours(23,59,59,999) 
      };
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Search by project or task title
    if (req.query.search) {
      query.$or = [
        { project_name: { $regex: req.query.search, $options: 'i' } },
        { task_title: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalNotes = await DailyNote.countDocuments(query);
    const dailyNotes = await DailyNote.find(query)
      .sort({ date: 'desc', createdAt: 'desc' })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render('daily-notes/index', {
      dailyNotes,
      filter,
      search: req.query.search || '',
      selectedStatus: req.query.status || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      page: 'daily-notes',
      totalPages: Math.ceil(totalNotes / limit),
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Show add form
// @route   GET /daily-notes/add
exports.addDailyNote = (req, res) => {
  res.render('daily-notes/create', {
    today: new Date().toISOString().split('T')[0]
  });
};

// @desc    Store daily note
// @route   POST /daily-notes
exports.storeDailyNote = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('daily-notes/create', {
      errors: errors.array(),
      formData: req.body,
      today: new Date().toISOString().split('T')[0]
    });
  }

  try {
    req.body.user = req.session.user._id;
    
    // Sanitize rich text inputs
    if (req.body.day_start_description) {
      req.body.day_start_description = sanitizeHtml(req.body.day_start_description);
    }
    if (req.body.day_end_description) {
      req.body.day_end_description = sanitizeHtml(req.body.day_end_description);
    }

    await DailyNote.create(req.body);
    req.flash('success_msg', 'Daily work log added successfully');
    res.redirect('/daily-notes');
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Show single daily note
// @route   GET /daily-notes/:id
exports.showDailyNote = async (req, res) => {
  try {
    const note = await DailyNote.findById(req.params.id).lean();
    if (!note || note.user.toString() !== req.session.user._id.toString()) {
      return res.render('error/404');
    }
    res.render('daily-notes/show', { note });
  } catch (err) {
    console.error(err);
    res.render('error/404');
  }
};

// @desc    Show edit form
// @route   GET /daily-notes/edit/:id
exports.editDailyNote = async (req, res) => {
  try {
    const note = await DailyNote.findById(req.params.id).lean();
    if (!note || note.user.toString() !== req.session.user._id.toString()) {
      return res.render('error/404');
    }
    res.render('daily-notes/edit', { note });
  } catch (err) {
    console.error(err);
    res.render('error/404');
  }
};

// @desc    Update daily note
// @route   PUT /daily-notes/:id
exports.updateDailyNote = async (req, res) => {
  try {
    let note = await DailyNote.findById(req.params.id);
    if (!note || note.user.toString() !== req.session.user._id.toString()) {
      return res.render('error/404');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('daily-notes/edit', {
        errors: errors.array(),
        note: { ...req.body, _id: req.params.id }
      });
    }

    // Sanitize rich text inputs
    if (req.body.day_start_description) {
      req.body.day_start_description = sanitizeHtml(req.body.day_start_description);
    }
    if (req.body.day_end_description) {
      req.body.day_end_description = sanitizeHtml(req.body.day_end_description);
    }

    await DailyNote.findByIdAndUpdate(req.params.id, req.body, { runValidators: true });
    req.flash('success_msg', 'Work log updated successfully');
    res.redirect(`/daily-notes/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Delete daily note
// @route   DELETE /daily-notes/:id
exports.deleteDailyNote = async (req, res) => {
  try {
    const note = await DailyNote.findById(req.params.id);
    if (!note || note.user.toString() !== req.session.user._id.toString()) {
      return res.render('error/404');
    }
    await DailyNote.deleteOne({ _id: req.params.id });
    req.flash('success_msg', 'Work log deleted');
    res.redirect('/daily-notes');
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Get Summary Report (Grouped by Date)
// @route   GET /daily-notes/report
exports.getSummaryReport = async (req, res) => {
  try {
    const user_id = req.session.user._id;
    
    // Set default range to show all records if not provided
    // We'll use an early date for startDate and today for endDate as defaults
    let filterStartDate = req.query.startDate ? new Date(req.query.startDate) : new Date(0); // Epoch start
    let filterEndDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    // Ensure they cover the full day
    filterStartDate.setHours(0, 0, 0, 0);
    filterEndDate.setHours(23, 59, 59, 999);

    const reportData = await DailyNote.aggregate([
      {
        $match: {
          user: user_id,
          date: { $gte: filterStartDate, $lte: filterEndDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
          },
          pendingTasks: {
            $sum: { $cond: [{ $in: ["$status", ["Pending", "Started", "InProgress"]] }, 1, 0] }
          },
          holiday: {
            $sum: { $cond: [{ $eq: ["$status", "Holiday"] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    res.render('daily-notes/report', {
      reportData,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      page: 'report',
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};