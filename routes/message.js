const express = require('express');
const router = express.Router();
const inboxControllers = require('../controllers/message');
const multer = require('multer');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const fsSync = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const axios = require('axios');
const { validateRequestBody, verifyToken, verifyUserId } = require('../middleware/validateRequest');
const FormData = require('form-data');


// ⚙️ Uncomment this line on production (e.g., cPanel or Linux server)
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

const uploadDir = './public/temp';

// 🪣 AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  }
});

// 🧠 Use memory storage for uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

const MURF_VOICE_IDS = [
  'en-US-alina',
  'en-US-terrell',
  'en-UK-hazel',
  'en-US-cooper',
  'en-US-imani',
  'it-IT-giorgio',
  'hi-IN-ayushi',
  'en-US-edmund',
  'fr-CA-alexis',
  'ko-KR-seok',
  'pt-BR-heitor',
  'en-AU-mitch'
];

// Add Murf API key to your environment variables
const MURF_API_KEY = process.env.MURF_API_KEY || 'ap2_56eb71fc-8d5c-434c-84cd-d62b55f7730c';

// Function to get random voice ID
function getRandomVoiceId() {
  return MURF_VOICE_IDS[Math.floor(Math.random() * MURF_VOICE_IDS.length)];
}

// Function to convert audio using Murf API
async function convertAudioWithMurf(audioBuffer, originalFilename) {
  try {
    const tempDir = './public/temp';
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }

    // Save audio buffer to temp file
    const tempInputPath = path.join(tempDir, `murf-input-${Date.now()}.mp3`);
    fsSync.writeFileSync(tempInputPath, audioBuffer);

    // Get random voice ID
    const voiceId = getRandomVoiceId();
    console.log(`🎭 Using Murf voice: ${voiceId}`);

    // Create form data for Murf API
    const form = new FormData();
    form.append('file', fsSync.createReadStream(tempInputPath));
    form.append('voice_id', voiceId);

    // Call Murf API
    const murfResponse = await axios.post(
      'https://api.murf.ai/v1/voice-changer/convert',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'api-key': MURF_API_KEY,
        },
        maxBodyLength: Infinity,
        timeout: 60000, // 60 second timeout
      }
    );

    // Clean up temp input file
    if (fsSync.existsSync(tempInputPath)) {
      fsSync.unlinkSync(tempInputPath);
    }

    // Check if Murf returned audio_file URL
    if (!murfResponse.data || !murfResponse.data.audio_file) {
      throw new Error('Murf API did not return audio file URL');
    }

    const convertedAudioUrl = murfResponse.data.audio_file;
    console.log(`✅ Murf conversion successful: ${convertedAudioUrl}`);

    // Download the converted audio from Murf
    const audioResponse = await axios.get(convertedAudioUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const convertedBuffer = Buffer.from(audioResponse.data);

    return {
      buffer: convertedBuffer,
      voiceId: voiceId
    };

  } catch (error) {
    console.error('❌ Murf API Error:', error.response?.data || error.message);
    throw new Error(`Murf voice conversion failed: ${error.message}`);
  }
}

// 🪄 Generate unique filename
function generateUniqueFilename(originalName, prefix = 'Audio', extension = '.mp3') {
  const uniqueId = uuidv4();
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${prefix}-${uniqueId}${ext}`;
}

// 🎧 Compress audio buffer safely
function compressAudioBuffer(audioBuffer, inputMimeType = 'audio/mpeg') {
  return new Promise((resolve, reject) => {
    const tempDir = './public/temp';
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }

    const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
    let ext = '.mp3';
    if (inputMimeType.includes('webm')) ext = '.webm';
    else if (inputMimeType.includes('m4a')) ext = '.m4a';
    else if (inputMimeType.includes('ogg')) ext = '.ogg';

    const tempInputPath = path.join(tempDir, `in-${Date.now()}${ext}`);
    const tempOutputPath = path.join(tempDir, `out-${Date.now()}.mp3`);

    try {
      fsSync.writeFileSync(tempInputPath, buffer);
      fsSync.fsyncSync(fsSync.openSync(tempInputPath, 'r'));
    } catch (writeError) {
      return reject(new Error(`Failed to write temp file: ${writeError.message}`));
    }

    ffmpeg(tempInputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('64k')
      .audioChannels(1)
      .audioFrequency(22050)
      .outputOptions([
        '-preset', 'veryfast',
        '-movflags', '+faststart',
        '-q:a', '9',
        '-compression_level', '8'
      ])
      .output(tempOutputPath)
      .on('end', () => {
        try {
          const compressedBuffer = fsSync.readFileSync(tempOutputPath);
          fsSync.unlinkSync(tempInputPath);
          fsSync.unlinkSync(tempOutputPath);
          resolve(compressedBuffer);
        } catch (readError) {
          reject(new Error(`Failed to read compressed file: ${readError.message}`));
        }
      })
      .on('error', (err) => {
        try {
          if (fsSync.existsSync(tempInputPath)) fsSync.unlinkSync(tempInputPath);
          if (fsSync.existsSync(tempOutputPath)) fsSync.unlinkSync(tempOutputPath);
        } catch (cleanupErr) {
          console.warn('Error removing temp files:', cleanupErr);
        }
        reject(new Error(`FFmpeg compression failed: ${err.message}`));
      })
      .run();
  });
}

// ☁️ Upload to S3
async function uploadToS3(fileBuffer, mimeType, originalName, prefix = 'audio', folderPath = 'images/audio', extension = '.mp3') {
  try {
    const filename = generateUniqueFilename(originalName, prefix, extension);
    const key = folderPath ? `${folderPath}/${filename}` : filename;

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${key}`;
    return { filename, url: s3Url };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// 👷 Worker thread for S3 upload
if (!isMainThread && workerData && workerData.isS3UploadWorker) {
  const { fileBuffer, mimeType, originalName, prefix, folderPath, extension } = workerData;
  uploadToS3(fileBuffer, mimeType, originalName, prefix, folderPath, extension)
    .then(result => parentPort.postMessage({ success: true, ...result }))
    .catch(error => parentPort.postMessage({ success: false, error: error.message }));
}

// 🧵 Upload file to S3 via worker
function uploadFileToS3WithWorker(fileBuffer, mimeType, originalName, prefix, folderPath, extension = '.mp3') {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: {
        isS3UploadWorker: true,
        fileBuffer,
        mimeType,
        originalName,
        prefix,
        folderPath,
        extension
      }
    });

    worker.on('message', (message) => {
      if (message.success) {
        resolve({ filename: message.filename, url: message.url });
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

// 🧩 Process uploaded audio file (with compression only)
async function processAudioFile(audioFile, folderPath) {
  try {
    let bufferToUpload;
    let contentType = 'audio/mpeg';
    const mimeType = audioFile.mimetype || 'audio/mpeg';
    console.log('📁 Received file MIME type:', mimeType);

    try {
      bufferToUpload = await compressAudioBuffer(audioFile.buffer, mimeType);
    } catch (compressionError) {
      console.warn('⚠️ Audio compression failed, using original file:', compressionError.message);
      bufferToUpload = audioFile.buffer;
      contentType = mimeType;
    }

    // Upload to S3
    const result = await uploadFileToS3WithWorker(
      bufferToUpload,
      contentType,
      audioFile.originalname,
      'audio',
      folderPath,
      '.mp3'
    );

    return result;
  } catch (error) {
    throw error;
  }
}

// 🖼️ Process uploaded image file (without compression - direct upload)
async function processImageFile(imageFile, prefix, folderPath) {
  try {
    const mimeType = imageFile.mimetype || 'image/jpeg';
    const extension = path.extname(imageFile.originalname) || '.jpg';

    console.log(`📁 Uploading ${prefix} - MIME type:`, mimeType);

    const result = await uploadFileToS3WithWorker(
      imageFile.buffer,
      mimeType,
      imageFile.originalname,
      prefix,
      folderPath,
      extension
    );
    return result;
  } catch (error) {
    throw error;
  }
}

// 🎤 API Route: Upload & Process Audio with Images
router.post('/create', upload.fields([
  { name: 'contentFile', maxCount: 1 },
  { name: 'emotionVoice', maxCount: 1 },
  { name: 'annoyimage', maxCount: 1 },
  { name: 'uploadedImage', maxCount: 1 },
  { name: 'ques5audio', maxCount: 1 },
  { name: 'ques8audio', maxCount: 1 },
]), validateRequestBody, async (req, res, next) => {
  try {
    // Process contentFile (audio with compression)
    if (req.files?.['contentFile']) {
      const contentFile = req.files['contentFile'][0];
      const { filename, url } = await processAudioFile(contentFile, 'images/message/question1');
      req.contentFile = filename;
      req.contentFileUrl = url;
    }

    console.log(req.files?.['emotionVoice']);
    
    if (req.files?.['emotionVoice']) {
      const emotionVoice = req.files['emotionVoice'][0];
      const { filename, url } = await processAudioFile(emotionVoice, 'images/message/question4');
      req.emotionVoice = filename;
      req.emotionVoiceUrl = url;
    }

    // Process annoyimage (direct upload without compression)
    if (req.files?.['annoyimage']) {
      const annoyimage = req.files['annoyimage'][0];
      const { filename, url } = await processImageFile(annoyimage, 'annoyimage', 'images/message/question3');
      req.annoyimage = filename;
      req.annoyimageUrl = url;
    }

    // Process uploadedImage (direct upload without compression)
    if (req.files?.['uploadedImage']) {
      const uploadedImage = req.files['uploadedImage'][0];
      const { filename, url } = await processImageFile(uploadedImage, 'uploadedImage', 'images/message/hintImage');
      console.log(url);

      req.uploadedImage = filename;
      req.uploadedImageUrl = url;
    }

    if (req.files?.['ques5audio']) {
      const ques5audio = req.files['ques5audio'][0];
      const { filename, url } = await processAudioFile(ques5audio, 'images/message/question5');
      req.ques5audio = filename;
      req.ques5audioUrl = url;
    }

    if (req.files?.['ques8audio']) {
      const ques8audio = req.files['ques8audio'][0];
      const { filename, url } = await processAudioFile(ques8audio, 'images/message/question8');
      req.ques8audio = filename;
      req.ques8audioUrl = url;
    }

    inboxControllers.Create(req, res, next);
  } catch (error) {
    console.error('❌ Error during file upload:', error);

    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

router.post('/read', upload.none(),  inboxControllers.ReadPagination);
router.post('/delete', upload.none(),  inboxControllers.Delete);

// ================================================= voice masking ============================================================
// Router with fallback logic
router.post('/voice-masking', upload.fields([
  { name: 'confessionVoice', maxCount: 1 },
]), validateRequestBody, async (req, res, next) => {
  try {
    console.log("enter");

    if (!req.files?.['confessionVoice']) {
      return res.status(400).json({
        success: false,
        message: 'confessionVoice file is required'
      });
    }

    const confessionVoice = req.files['confessionVoice'][0];
    console.log('📁 Original file received:', confessionVoice.originalname);

    let finalBuffer = confessionVoice.buffer;
    let voiceConverted = false;
    let voiceId = null;

    // Step 1: Try converting voice using Murf API with timeout
    try {
      console.log('🎙️ Attempting voice conversion with Murf API...');

      // Add timeout wrapper for Murf API call
      const conversionPromise = convertAudioWithMurf(
        confessionVoice.buffer,
        confessionVoice.originalname
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Murf API timeout')), 10000) // 10 second timeout
      );

      const { buffer: convertedBuffer, voiceId: murfVoiceId } = await Promise.race([
        conversionPromise,
        timeoutPromise
      ]);

      console.log('✅ Voice converted successfully with Murf API');
      finalBuffer = convertedBuffer;
      voiceConverted = true;
      voiceId = murfVoiceId;

    } catch (murfError) {
      console.warn('⚠️ Murf API conversion failed:', murfError.message);
      console.log('📝 Using original audio as fallback');
      // Continue with original buffer
      finalBuffer = confessionVoice.buffer;
      voiceConverted = false;
    }

    // Step 2: Compress the audio (converted or original)
    try {
      console.log('🎵 Compressing audio...');
      const compressedBuffer = await compressAudioBuffer(
        finalBuffer,
        confessionVoice.mimetype
      );
      finalBuffer = compressedBuffer;
      console.log('✅ Audio compressed successfully');
    } catch (compressionError) {
      console.warn('⚠️ Compression failed, using uncompressed audio:', compressionError.message);
      // finalBuffer remains unchanged
    }

    // Step 3: Upload to S3
    console.log('☁️ Uploading to S3...');
    const prefix = voiceConverted ? 'masked-' : 'original-';
    const audioPath =
      req.body.que == "8"
        ? "images/question8/Audio"
        : "images/question5/Audio";

    const { filename, url } = await uploadFileToS3WithWorker(
      finalBuffer,
      'audio/mpeg',
      `${prefix}${confessionVoice.originalname}`,
      'audio-masked',
      audioPath,
      '.mp3'
    );
    console.log('✅ Upload complete:', url);

    // Attach to request for controller
    req.confessionVoice = filename;
    req.confessionVoiceUrl = url;
    req.voiceConverted = voiceConverted;
    req.usedVoiceId = voiceId;

    // Add audio status to request body
    req.audioStatus = voiceConverted ? 'masked' : 'original';

    // Pass to controller
    inboxControllers.VoiceMasking(req, res, next);

  } catch (error) {
    console.error('❌ Error during voice masking:', error);
    res.status(500).json({
      success: false,
      message: 'Voice masking failed',
      details: error.message
    });
  }
});

module.exports = router;