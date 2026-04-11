const express = require('express');
const router = express.Router();
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const Note = require('../models/Note');
const Category = require('../models/Category');
const { MODULES } = require('../config/permissions');

const upload = require('../middleware/upload');
const sanitizeHtml = require('sanitize-html');
const accessService = require('../services/accessService');

router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.NOTES));

// Show Add Page
router.get('/add', async (req, res) => {
  try {
    const categories = await Category.find({ user: req.session.user._id });
    res.render('notes/add', {
      categories,
      page: 'notes'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

// Process Add Form
router.post('/', upload.single('file'), async (req, res) => {
  try {
    req.body.user = req.session.user._id;
    if (req.file) {
      req.body.file = req.file.filename;
    }
    
    // Sanitize rich text input
    if (req.body.description) {
      req.body.description = sanitizeHtml(req.body.description);
    }

    await Note.create(req.body);
    req.flash('success_msg', 'Note created successfully');
    res.redirect('/notes');
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

// Show All Notes
router.get('/', async (req, res) => {
  try {
    let query = { ...accessService.getVisibleUserFilter(req.session.user), status: 'active' };

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    const notes = await Note.find(query)
      .populate('category')
      .sort({ isPinned: -1, createdAt: 'desc' })
      .lean();
      
    const categories = await Category.find(accessService.getVisibleUserFilter(req.session.user)).lean();

    res.render('notes/index', {
      notes,
      categories,
      search: req.query.search || '',
      selectedCategory: req.query.category || '',
      selectedPriority: req.query.priority || '',
      page: 'notes'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

// Trash Can View
router.get('/trash/view', async (req, res) => {
    try {
        const notes = await Note.find({ ...accessService.getVisibleUserFilter(req.session.user), status: 'trash' })
            .populate('category')
            .sort({ createdAt: 'desc' })
            .lean();
        res.render('notes/trash', { notes, page: 'trash' });
    } catch (err) {
        console.error(err);
        res.render('error/500');
    }
});

// Show Single Note
router.get('/:id', async (req, res) => {
  try {
    let note = await Note.findById(req.params.id).populate('category').populate('convertedTask').lean();

    if (!note) {
      return res.render('error/404');
    }

    const canView = accessService.getUserContext(req.session.user).role !== 'employee' || `${note.user}` === `${req.session.user._id}`;
    if (!canView) {
      res.redirect('/notes');
    } else {
      res.render('notes/show', {
        note,
      });
    }
  } catch (err) {
    console.error(err);
    res.render('error/404');
  }
});

// Show Edit Page
router.get('/edit/:id', async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id
    }).lean();

    if (!note) {
      return res.render('error/404');
    }

    const canEdit = accessService.getUserContext(req.session.user).role !== 'employee' || `${note.user}` === `${req.session.user._id}`;
    if (!canEdit) {
      res.redirect('/notes');
    } else {
      const categories = await Category.find(accessService.getVisibleUserFilter(req.session.user));
      res.render('notes/edit', {
        note,
        categories
      });
    }
  } catch (err) {
    console.error(err);
    return res.render('error/500');
  }
});

// Update Note
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    let note = await Note.findById(req.params.id).lean();

    if (!note) {
      return res.render('error/404');
    }

    const canEdit = accessService.getUserContext(req.session.user).role !== 'employee' || `${note.user}` === `${req.session.user._id}`;
    if (!canEdit) {
      res.redirect('/notes');
    } else {
        let updateData = req.body;
        if(req.file){
            updateData.file = req.file.filename;
        }

        // Sanitize rich text input
        if (updateData.description) {
          updateData.description = sanitizeHtml(updateData.description);
        }

      note = await Note.findOneAndUpdate({ _id: req.params.id }, updateData, {
        new: true,
        runValidators: true,
      });

      req.flash('success_msg', 'Note updated successfully');
      res.redirect('/notes');
    }
  } catch (err) {
    console.error(err);
    return res.render('error/500');
  }
});

// Move to Trash (Soft Delete)
router.delete('/trash/:id', async (req, res) => {
  try {
    let note = await Note.findById(req.params.id).lean();
    if (!note) return res.render('error/404');
    const canEdit = accessService.getUserContext(req.session.user).role !== 'employee' || `${note.user}` === `${req.session.user._id}`;
    if (!canEdit) return res.redirect('/notes');

    await Note.findOneAndUpdate({ _id: req.params.id }, { status: 'trash' });
    req.flash('success_msg', 'Note moved to trash');
    res.redirect('/notes');
  } catch (err) {
    console.error(err);
    return res.render('error/500');
  }
});

// Restore from Trash
router.put('/restore/:id', async (req, res) => {
    try {
      let note = await Note.findById(req.params.id).lean();
      if (!note) return res.render('error/404');
      const canEdit = accessService.getUserContext(req.session.user).role !== 'employee' || `${note.user}` === `${req.session.user._id}`;
      if (!canEdit) return res.redirect('/notes');
  
      await Note.findOneAndUpdate({ _id: req.params.id }, { status: 'active' });
      req.flash('success_msg', 'Note restored');
      res.redirect('/notes/trash');
    } catch (err) {
      console.error(err);
      return res.render('error/500');
    }
  });

// Permanent Delete
router.delete('/:id', async (req, res) => {
  try {
    let note = await Note.findById(req.params.id).lean();
    if (!note) return res.render('error/404');
    const canEdit = accessService.getUserContext(req.session.user).role !== 'employee' || `${note.user}` === `${req.session.user._id}`;
    if (!canEdit) return res.redirect('/notes');

    await Note.deleteOne({ _id: req.params.id });
    req.flash('success_msg', 'Note permanently deleted');
    res.redirect('/notes/trash');
  } catch (err) {
    console.error(err);
    return res.render('error/500');
  }
});

module.exports = router;
