const express = require('express');
const router = express.Router();
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const Category = require('../models/Category');
const { MODULES } = require('../config/permissions');

router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.CATEGORIES));

// Show All Categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ user: req.session.user._id }).sort({ createdAt: 'desc' }).lean();
    res.render('categories/index', {
      categories,
      page: 'categories'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

// Create Category
router.post('/', async (req, res) => {
  try {
    req.body.user = req.session.user._id;
    await Category.create(req.body);
    req.flash('success_msg', 'Category created successfully');
    res.redirect('/categories');
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
});

// Delete Category
router.delete('/:id', async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);
    if (!category) return res.render('error/404');
    if (category.user != req.session.user._id) return res.redirect('/categories');

    await Category.deleteOne({ _id: req.params.id });
    req.flash('success_msg', 'Category deleted successfully');
    res.redirect('/categories');
  } catch (err) {
    console.error(err);
    return res.render('error/500');
  }
});

module.exports = router;
