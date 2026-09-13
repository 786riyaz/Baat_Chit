const multer = require("multer");

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB - profile photos don't need the 25MB media limit

const uploadAvatar = multer({
storage: multer.memoryStorage(),
limits: {
fileSize: MAX_AVATAR_SIZE,
files: 1
},
fileFilter: (req, file, callback) => {
if (!file.mimetype.startsWith("image/")) {
return callback(new Error("Profile photo must be an image"));
}
callback(null, true);
}
});

module.exports = { uploadAvatar, MAX_AVATAR_SIZE };
