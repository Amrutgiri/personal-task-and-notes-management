const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const dailyNoteController = require('../controllers/dailyNoteController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const { MODULES } = require('../config/permissions');

// Apply auth middleware to all routes
router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.DAILY_NOTES));

// Validation rules
const validateDailyNote = [
  check('date', 'Date is required').not().isEmpty(),
  check('project_name', 'Project Name is required').not().isEmpty(),
  check('task_title', 'Task Title is required').not().isEmpty(),
  check('day_start_description', 'Day Start Description is required').not().isEmpty(),
  check('status', 'Status is required').not().isEmpty()
];

// Routes
router.get('/', dailyNoteController.getDailyNotes);
router.get('/add', dailyNoteController.addDailyNote);
router.get('/report', dailyNoteController.getSummaryReport);
router.post('/sync', dailyNoteController.syncToGoogleSheets);
router.post('/preview-import', dailyNoteController.previewImportFromGoogleSheets);
router.post('/import', dailyNoteController.importFromGoogleSheets);
router.post('/backfill-uids', dailyNoteController.backfillSheetUIDs);
router.post('/settings', dailyNoteController.updateSyncSettings);
router.post('/', validateDailyNote, dailyNoteController.storeDailyNote);
router.get('/:id', dailyNoteController.showDailyNote);
router.get('/edit/:id', dailyNoteController.editDailyNote);
router.put('/:id', validateDailyNote, dailyNoteController.updateDailyNote);
router.delete('/:id', dailyNoteController.deleteDailyNote);

module.exports = router;
