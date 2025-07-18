# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 🚨 Google Colab Issues

#### "Package installation failed"
**Solution:**
```python
# Try installing packages one by one
!pip install pydub
!pip install google-colab-auth
!apt-get install ffmpeg
```

#### "Authentication failed"
**Solution:**
1. Clear browser cookies for Google Colab
2. Try incognito/private browsing mode
3. Re-run the authentication cell

#### "Audio file upload failed"
**Solution:**
1. Check file size (max ~100MB recommended)
2. Try converting to MP3 format first
3. Ensure stable internet connection

#### "Audio processing failed"
**Solution:**
```python
# Check audio file format
import os
print(f"File exists: {os.path.exists(audio_path)}")
print(f"File size: {os.path.getsize(audio_path) / 1024 / 1024:.2f} MB")

# Try loading with pydub
from pydub import AudioSegment
audio = AudioSegment.from_file(audio_path)
print(f"Duration: {len(audio) / 1000 / 60:.2f} minutes")
```

### 🚨 Google Apps Script Issues

#### "GOOGLE_API_KEY not found"
**Solution:**
1. Go to Apps Script Settings (⚙️)
2. Scroll to "Script Properties"
3. Add property: Name=`GOOGLE_API_KEY`, Value=your API key
4. Click Save
5. Re-run the script

#### "Drive API not enabled"
**Solution:**
1. In Apps Script, click Services (+)
2. Find "Google Drive API"
3. Click Add
4. Save the project

#### "Upload initialization failed"
**Possible causes:**
- Invalid API key
- API quota exceeded
- Network issues

**Solution:**
```javascript
// Test API key
function testApiKey() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_API_KEY');
  console.log('API Key found:', !!apiKey);
  console.log('API Key length:', apiKey ? apiKey.length : 0);
}
```

#### "File processing timeout"
**Solution:**
1. Check file size (should be under 20MB per chunk)
2. Try with smaller audio chunks
3. Check internet connection stability

#### "Transcription failed"
**Solution:**
```javascript
// Debug transcription
function debugTranscription(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    console.log('File name:', file.getName());
    console.log('File size:', file.getSize());
    console.log('MIME type:', file.getBlob().getContentType());
  } catch (error) {
    console.error('File access error:', error.message);
  }
}
```

### 🚨 General Issues

#### "No audio files found in folder"
**Solution:**
1. Check folder ID is correct
2. Verify files uploaded successfully to Google Drive
3. Ensure files have audio extensions (.mp3, .wav, etc.)

#### "All chunks failed to process"
**Solution:**
1. Run `testSetup()` to check configuration
2. Try processing one file at a time
3. Check API quotas and limits
4. Verify audio file formats are supported

#### "Execution timeout"
**Solution:**
1. Process fewer chunks at once
2. Increase delays between chunks
3. Split large jobs into smaller batches

### 🔍 Debugging Tools

#### Test Functions
```javascript
// Test system setup
function testSetup() {
  // Checks API key, Drive access, etc.
}

// Test single file
function testSingleFile() {
  const fileId = 'YOUR_FILE_ID';
  return transcribeAudioChunks([fileId]);
}

// Get system info
function getSystemInfo() {
  // Shows user, API key status, etc.
}
```

#### Colab Debug Commands
```python
# Check audio file
import os
from pydub import AudioSegment

audio_path = "/content/your_file.mp3"
print(f"File exists: {os.path.exists(audio_path)}")
print(f"File size: {os.path.getsize(audio_path) / 1024 / 1024:.2f} MB")

audio = AudioSegment.from_file(audio_path)
print(f"Duration: {len(audio) / 1000 / 60:.2f} minutes")
print(f"Sample rate: {audio.frame_rate}")
print(f"Channels: {audio.channels}")
```

### 📞 Getting Help

#### Check Logs
1. **Colab**: Look at cell outputs for error messages
2. **Apps Script**: Check Execution Transcript for detailed logs

#### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "API key not found" | Missing API key in Script Properties | Add GOOGLE_API_KEY to Script Properties |
| "Drive API not enabled" | Drive API service not added | Add Drive API in Services |
| "File not found" | Invalid file ID or folder ID | Check IDs from Colab output |
| "Processing timeout" | File taking too long to process | Try smaller files or check connection |
| "Upload failed" | Network or API issue | Retry or check API quotas |

#### Still Need Help?
1. Run `testSetup()` and share the output
2. Check the execution logs for detailed error messages
3. Verify all setup steps were completed correctly
4. Try with a smaller test file first

### 🎯 Prevention Tips

1. **Start Small**: Test with a short audio file first
2. **Check Setup**: Always run `testSetup()` before processing
3. **Monitor Logs**: Watch execution logs for early warning signs
4. **Backup**: Keep copies of your audio files
5. **Stable Connection**: Use reliable internet for uploads

Most issues are configuration-related and can be resolved by double-checking the setup steps!