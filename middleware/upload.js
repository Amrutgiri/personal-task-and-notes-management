const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinaryService');
const path = require('path');

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'authpages/others';
    if (req.path.includes('profile')) folder = 'authpages/profiles';
    if (req.path.includes('chat')) folder = 'authpages/chats';

    const fileExt = path.extname(file.originalname).substring(1).toLowerCase();
    
    // For non-image files, Cloudinary needs 'raw' resource_type
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
    const isVideo = ['mp4', 'mov', 'avi'].includes(fileExt);

    return {
      folder: folder,
      resource_type: isImage ? 'image' : (isVideo ? 'video' : 'raw'),
      public_id: file.fieldname + '-' + Date.now(),
      format: isImage || isVideo ? fileExt : undefined
    };
  },
});

// Init upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

// Check file type
function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif|pdf|txt|doc|docx|mp4|mov|zip|js|html|css/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype || extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: File type not supported!'));
  }
}

module.exports = upload;