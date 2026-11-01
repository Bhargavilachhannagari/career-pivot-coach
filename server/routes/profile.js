import { Router } from 'express';
import multer from 'multer';
import { describeProfile, getProfile, updateProfile, uploadResume } from '../controllers/profile.js';
import { HttpError } from '../utils/httpError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) =>
    file.mimetype === 'application/pdf' ? done(null, true) : done(new HttpError(400, 'Please upload a PDF file.')),
});

const router = Router();

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/profile/describe', describeProfile);
router.post('/resume/upload', upload.single('resume'), uploadResume);

export default router;
