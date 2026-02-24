const express = require('express');
const router = express.Router();
const inboxControllers = require('../controllers/inboxnew');
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
      const { filename, url } = await processAudioFile(contentFile, 'images/audio');
      req.contentFile = filename;
      req.contentFileUrl = url;
    }

    console.log(req.files?.['emotionVoice']);

    if (req.files?.['emotionVoice']) {
      const emotionVoice = req.files['emotionVoice'][0];
      const { filename, url } = await processAudioFile(emotionVoice, 'images/question4/Audio');
      req.emotionVoice = filename;
      req.emotionVoiceUrl = url;
    }

    // Process annoyimage (direct upload without compression)
    if (req.files?.['annoyimage']) {
      const annoyimage = req.files['annoyimage'][0];
      const { filename, url } = await processImageFile(annoyimage, 'annoyimage', 'images/annoyimage');
      req.annoyimage = filename;
      req.annoyimageUrl = url;
    }

    // Process uploadedImage (direct upload without compression)
    if (req.files?.['uploadedImage']) {
      const uploadedImage = req.files['uploadedImage'][0];
      const { filename, url } = await processImageFile(uploadedImage, 'uploadedImage', 'images/hintImage');
      console.log(url);

      req.uploadedImage = filename;
      req.uploadedImageUrl = url;
    }

    if (req.files?.['ques5audio']) {
      const ques5audio = req.files['ques5audio'][0];
      const { filename, url } = await processAudioFile(ques5audio, 'images/question5/Audio');
      req.ques5audio = filename;
      req.ques5audioUrl = url;
    }

    if (req.files?.['ques8audio']) {
      const ques8audio = req.files['ques8audio'][0];
      const { filename, url } = await processAudioFile(ques8audio, 'images/question8/Audio');
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

// Merge route - outputs .mp4 files
// Enhanced download function with retry logic and better error handling
// Enhanced download function with retry logic and better error handling
async function downloadFileWithRetry(url, filePath, maxRetries = 3, timeoutMs = 120000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} downloading: ${url}`);

      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream', // Use stream instead of arraybuffer for large files
        timeout: timeoutMs,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        // Add these options for better connection handling
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        httpsAgent: new (require('https').Agent)({
          keepAlive: true,
          timeout: timeoutMs
        })
      });

      // Create write stream and pipe the response
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Successfully downloaded: ${url}`);
          resolve();
        });

        writer.on('error', (err) => {
          console.error(`❌ Write error on attempt ${attempt}:`, err.message);
          reject(err);
        });

        response.data.on('error', (err) => {
          console.error(`❌ Stream error on attempt ${attempt}:`, err.message);
          reject(err);
        });
      });

    } catch (error) {
      console.error(`❌ Download attempt ${attempt} failed:`, error.message);

      // Clean up partial file if it exists
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr.message);
        }
      }

      if (attempt === maxRetries) {
        throw new Error(`Failed to download after ${maxRetries} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Updated route with better error handling
router.post('/merge', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'videoFile', maxCount: 1 }
]), async (req, res) => {
  const audioUrl = req.body.audioUrl;
  const videoUrl = req.body.videoUrl;
  const hasVideoFile = req.files && req.files.videoFile;

  // Validate input
  if (!req.files || !req.files.image) {
    if (audioUrl) {
      return res.status(200).json({
        message: 'No image provided — returning audio URL directly.',
        videoUrl: audioUrl
      });
    } else if (videoUrl) {
      return res.status(200).json({
        message: 'No image provided — returning video URL directly.',
        videoUrl: videoUrl
      });
    } else {
      return res.status(400).json({
        message: 'Either audioUrl or videoUrl is required when no image is provided.'
      });
    }
  }

  // Check for multiple video sources
  const videoSourceCount = [audioUrl, videoUrl, hasVideoFile].filter(Boolean).length;
  if (videoSourceCount > 1) {
    return res.status(400).json({
      message: 'Please provide only one of: audioUrl, videoUrl, or videoFile.'
    });
  }

  let responseAlreadySent = false;

  const sendResponse = (statusCode, data) => {
    if (!responseAlreadySent && !res.headersSent) {
      responseAlreadySent = true;
      return res.status(statusCode).json(data);
    }
  };

  const cleanupFiles = (filePaths) => {
    filePaths.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.error(`Cleanup error for ${filePath}:`, cleanupErr.message);
      }
    });
  };

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const imageExt = path.extname(req.files.image[0].originalname);
    const imagePath = path.join(uploadDir, `img-${timestamp}${imageExt}`);
    const outputVideoPath = path.join(uploadDir, `output-${timestamp}.mp4`);

    // Write image file asynchronously
    await fs.promises.writeFile(imagePath, req.files.image[0].buffer);

    // Upload image to S3 in parallel (non-blocking)
    let imageS3Url = null;
    const imageUploadPromise = (async () => {
      try {
        const imageBuffer = req.files.image[0].buffer;
        const imageMimeType = req.files.image[0].mimetype || 'image/jpeg';

        const { filename: imageFilename, url: imageUrl } = await uploadToS3(
          imageBuffer,
          imageMimeType,
          `image-${timestamp}${imageExt}`,
          'image',
          'images/uploads',
          imageExt
        );

        imageS3Url = imageUrl;
        console.log('✅ Image uploaded to S3:', imageS3Url);
        console.log('📦 Image S3 Key:', `images/uploads/${imageFilename}`);
      } catch (imageUploadErr) {
        console.error('❌ Image S3 upload error:', imageUploadErr.message);
      }
    })();

    let ffmpegCommand = ffmpeg();
    let allFilesToCleanup = [imagePath, outputVideoPath];

    if (audioUrl) {
      // Audio processing - maximum speed
      const audioPath = path.join(uploadDir, `aud-${timestamp}.mp3`);
      allFilesToCleanup.push(audioPath);

      try {
        const response = await axios.get(audioUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxRedirects: 2,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Encoding': 'gzip, deflate'
          }
        });
        await fs.promises.writeFile(audioPath, Buffer.from(response.data));
      } catch (downloadError) {
        console.error('Audio download failed:', downloadError.message);
        cleanupFiles(allFilesToCleanup);
        return sendResponse(500, {
          message: 'Failed to download audio file.',
          details: downloadError.message
        });
      }

      ffmpegCommand
        .input(imagePath)
        .loop()
        .input(audioPath)
        .outputOptions([
          '-shortest',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=fast_bilinear',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '30',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '64k',
          '-ar', '44100',
          '-ac', '2',
          '-movflags', '+faststart',
          '-threads', '0',
          '-tune', 'fastdecode',
          '-profile:v', 'baseline',
          '-level', '3.0'
        ]);

    } else if (videoUrl || hasVideoFile) {
      const videoPath = path.join(uploadDir, `vid-${timestamp}.mp4`);
      allFilesToCleanup.push(videoPath);

      // Handle video file upload or URL download
      if (hasVideoFile) {
        // Direct video file upload - use async write
        try {
          console.log('📹 Writing video file from upload...');
          const startWrite = Date.now();
          await fs.promises.writeFile(videoPath, req.files.videoFile[0].buffer);
          console.log(`✅ Video file written in ${Date.now() - startWrite}ms`);
        } catch (writeError) {
          console.error('Video file write failed:', writeError.message);
          cleanupFiles(allFilesToCleanup);
          return sendResponse(500, {
            message: 'Failed to write video file.',
            details: writeError.message
          });
        }
      } else {
        // Download from URL
        console.log('📹 Downloading video from URL...');
        const startDownload = Date.now();
        try {
          await downloadFileWithRetry(videoUrl, videoPath, 2, 90000);
          console.log(`✅ Video downloaded in ${Date.now() - startDownload}ms`);
        } catch (downloadError) {
          console.error('Video download failed:', downloadError.message);
          cleanupFiles(allFilesToCleanup);
          return sendResponse(500, {
            message: 'Failed to download video file.',
            details: downloadError.message
          });
        }
      }

      // Parallel dimension probing with timeout
      console.log('🔍 Probing media dimensions...');
      const probeStart = Date.now();

      const [imageDimensions, videoDimensions] = await Promise.race([
        Promise.all([
          new Promise((resolve, reject) => {
            ffmpeg.ffprobe(imagePath, (err, metadata) => {
              if (err) reject(err);
              else resolve({ width: metadata.streams[0].width, height: metadata.streams[0].height });
            });
          }),
          new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
              if (err) reject(err);
              else {
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                resolve({ width: videoStream.width, height: videoStream.height });
              }
            });
          })
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Probe timeout after 10s')), 10000)
        )
      ]).catch(probeError => {
        console.error('Probe failed:', probeError.message);
        cleanupFiles(allFilesToCleanup);
        sendResponse(500, {
          message: 'Failed to get media dimensions.',
          details: probeError.message
        });
        return null;
      });

      if (!imageDimensions || !videoDimensions) return;

      console.log(`✅ Dimensions probed in ${Date.now() - probeStart}ms`);
      console.log(`📐 Image: ${imageDimensions.width}x${imageDimensions.height}`);
      console.log(`📐 Video: ${videoDimensions.width}x${videoDimensions.height}`);

      const extraWidth = req.body.videoUrl ? 200 : 0;
      const targetWidth = Math.ceil((imageDimensions.width + extraWidth) / 2) * 2;
      const targetHeight = Math.ceil(imageDimensions.height / 2) * 2;

      console.log(`🎯 Target dimensions: ${targetWidth}x${targetHeight}`);

      const isLandscapeVideo = videoDimensions.width > videoDimensions.height;

      // Optimized filter with reduced quality for speed
      if (isLandscapeVideo) {
        ffmpegCommand
          .input(videoPath)
          .input(imagePath)
          .complexFilter([
            // Simplified scaling with reduced quality for speed
            `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease:flags=fast_bilinear,` +
            `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,fps=24[scaled_video]`,
            `[scaled_video][1:v]overlay=x=(main_w-overlay_w)/2:y='if(lt(main_h-overlay_h-30,0),0,main_h-overlay_h-30)'[output]`
          ])
          .outputOptions([
            '-map', '[output]',
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-preset', 'veryfast', // Changed from ultrafast for better compression
            '-crf', '28', // Reduced from 30 for slightly better quality
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '64k',
            '-ar', '44100',
            '-ac', '2',
            '-movflags', '+faststart',
            '-threads', '0',
            '-max_muxing_queue_size', '4096', // Increased buffer
            '-tune', 'zerolatency', // Removed fastdecode for better speed
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-g', '48',
            '-sc_threshold', '0',
            '-bf', '0',
            '-refs', '1',
            '-me_method', 'dia',
            '-subq', '0',
            '-partitions', 'none',
            '-flags', '+cgop',
            '-mpv_flags', '+nopimb+forcemv'
          ]);
      } else {
        ffmpegCommand
          .input(videoPath)
          .input(imagePath)
          .complexFilter([
            `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase:flags=fast_bilinear,` +
            `crop=${targetWidth}:${targetHeight},fps=24[scaled_video]`,
            `[scaled_video][1:v]overlay=x=(main_w-overlay_w)/2:y='if(lt(main_h-overlay_h-30,0),0,main_h-overlay_h-30)'[output]`
          ])
          .outputOptions([
            '-map', '[output]',
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '28',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '64k',
            '-ar', '44100',
            '-ac', '2',
            '-movflags', '+faststart',
            '-threads', '0',
            '-max_muxing_queue_size', '4096',
            '-tune', 'zerolatency',
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-g', '48',
            '-sc_threshold', '0',
            '-bf', '0',
            '-refs', '1',
            '-me_method', 'dia',
            '-subq', '0',
            '-partitions', 'none',
            '-flags', '+cgop',
            '-mpv_flags', '+nopimb+forcemv'
          ]);
      }
    }

    // Extended timeout for video file processing
    const timeoutDuration = (videoUrl || hasVideoFile) ? 120000 : 45000; // Increased to 120s

    const timeoutId = setTimeout(() => {
      if (!responseAlreadySent && !res.headersSent) {
        console.error('⏱️ Processing timeout after', timeoutDuration / 1000, 'seconds');
        try {
          ffmpegCommand.kill('SIGKILL');
        } catch (killErr) { }
        cleanupFiles(allFilesToCleanup);
        sendResponse(408, {
          message: 'Operation timeout.'
        });
      }
    }, timeoutDuration);

    let lastProgressTime = Date.now();
    let lastProgressPercent = 0;

    ffmpegCommand
      .on('start', (commandLine) => {
        console.log('🎬 FFmpeg started');
        console.log('Command:', commandLine);
      })
      .on('progress', (progress) => {
        const now = Date.now();

        // Log progress every 10%
        if (progress.percent && Math.floor(progress.percent / 10) > Math.floor(lastProgressPercent / 10)) {
          console.log(`⏳ Processing: ${Math.floor(progress.percent)}%`);
          lastProgressPercent = progress.percent;
        }

        // Check for stall (increased to 45s for video processing)
        if (now - lastProgressTime > 45000) {
          console.error('❌ Processing stalled - no progress for 45s');
          try {
            ffmpegCommand.kill('SIGKILL');
          } catch (e) { }
        }
        lastProgressTime = now;
      })
      .on('end', async () => {
        clearTimeout(timeoutId);
        console.log('✅ FFmpeg processing complete');

        if (responseAlreadySent || res.headersSent) {
          cleanupFiles(allFilesToCleanup);
          return;
        }

        try {
          // Wait for image upload to complete
          await imageUploadPromise;

          console.log('📤 Uploading merged video to S3...');
          const uploadStart = Date.now();

          const videoBuffer = await fs.promises.readFile(outputVideoPath);
          console.log(`📦 Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);

          const { filename, url } = await uploadToS3(
            videoBuffer,
            'video/mp4',
            `merged-${timestamp}.mp4`,
            'video',
            'videos/merged',
            '.mp4'
          );

          console.log(`✅ Video uploaded in ${Date.now() - uploadStart}ms`);

          // Schedule deletion after 5 minutes
          setTimeout(async () => {
            try {
              await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: `videos/merged/${filename}`
              }));
              console.log(`🗑️ Deleted ${filename} from S3`);
            } catch (deleteErr) {
              console.error('❌ Delete error:', deleteErr.message);
            }
          }, 5 * 60 * 1000);

          cleanupFiles(allFilesToCleanup);

          const mediaType = audioUrl ? 'Image + Audio' : 'Image + Video';
          sendResponse(200, {
            message: `${mediaType} merged successfully.`,
            videoUrl: url,
            imageUrl: imageS3Url
          });

        } catch (uploadErr) {
          console.error('❌ Upload error:', uploadErr);
          cleanupFiles(allFilesToCleanup);
          sendResponse(500, {
            message: 'Error uploading video.',
            details: uploadErr.message
          });
        }
      })
      .on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('❌ FFmpeg Error:', err.message);
        cleanupFiles(allFilesToCleanup);
        sendResponse(500, {
          message: 'Error processing files.',
          details: err.message
        });
      })
      .save(outputVideoPath);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    sendResponse(500, {
      message: 'Unexpected error occurred.',
      details: error.message
    });
  }
});

router.post('/read', upload.none(), validateRequestBody, verifyToken, verifyUserId, inboxControllers.Read);
router.post('/find', upload.none(), validateRequestBody, verifyToken, verifyUserId, inboxControllers.ReadPagination);
router.post('/delete', upload.none(), validateRequestBody, verifyToken, verifyUserId, inboxControllers.Delete);

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