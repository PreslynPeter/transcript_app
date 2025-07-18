# 🎵 Fresh Audio Transcription System
## Google Colab + Apps Script Integration

This is a complete solution that combines Google Colab for audio processing with Apps Script for transcription.

## 🏗️ System Architecture

```
[Long Audio File] → [Google Colab] → [Audio Chunks] → [Google Drive] → [Apps Script] → [Transcription]
```

## 📋 Part 1: Google Colab Audio Chunker

### Step 1: Create a New Colab Notebook

Go to [Google Colab](https://colab.research.google.com) and create a new notebook. Copy and paste the following cells:

### Cell 1: Install Dependencies
```python
# Install required packages
!pip install pydub google-colab-auth google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
!apt-get update &> /dev/null
!apt-get install ffmpeg &> /dev/null

print("✅ All packages installed successfully!")
```

### Cell 2: Import Libraries
```python
import os
import time
from datetime import datetime, timedelta
from pydub import AudioSegment
from google.colab import files, auth
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth import default
import tempfile
import json

print("📦 All imports successful!")
```

### Cell 3: Authenticate Google Drive
```python
# Authenticate with Google Drive
auth.authenticate_user()
creds, _ = default()
drive_service = build('drive', 'v3', credentials=creds)

print("🔐 Google Drive authentication successful!")
```

### Cell 4: Audio Chunker Class
```python
class AudioChunker:
    def __init__(self, chunk_duration_minutes=25):
        self.chunk_duration_minutes = chunk_duration_minutes
        self.chunk_duration_ms = chunk_duration_minutes * 60 * 1000
        self.drive_service = drive_service
        
    def create_drive_folder(self, folder_name):
        """Create a folder in Google Drive"""
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        
        folder = self.drive_service.files().create(
            body=folder_metadata,
            fields='id'
        ).execute()
        
        return folder.get('id')
    
    def upload_to_drive(self, file_path, folder_id, file_name):
        """Upload file to Google Drive folder"""
        file_metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        
        media = MediaFileUpload(file_path, resumable=True)
        file = self.drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        return file.get('id')
    
    def split_audio(self, audio_file_path):
        """Split audio file into chunks"""
        print(f"🔄 Loading audio file: {audio_file_path}")
        
        # Load audio file
        audio = AudioSegment.from_file(audio_file_path)
        total_duration_ms = len(audio)
        total_minutes = total_duration_ms / (1000 * 60)
        
        print(f"📊 Total audio duration: {total_minutes:.2f} minutes")
        
        # If audio is shorter than chunk size, return as single chunk
        if total_duration_ms <= self.chunk_duration_ms:
            print("📝 Audio is short enough, no chunking needed")
            return [(audio_file_path, 0, total_duration_ms)]
        
        # Create chunks
        chunks = []
        chunk_start = 0
        chunk_number = 1
        
        # Create temporary directory for chunks
        temp_dir = tempfile.mkdtemp()
        print(f"📁 Created temporary directory: {temp_dir}")
        
        while chunk_start < total_duration_ms:
            chunk_end = min(chunk_start + self.chunk_duration_ms, total_duration_ms)
            
            # Extract chunk
            chunk_audio = audio[chunk_start:chunk_end]
            
            # Save chunk to temporary file
            chunk_filename = os.path.join(temp_dir, f"chunk_{chunk_number:03d}.mp3")
            chunk_audio.export(chunk_filename, format="mp3")
            
            chunks.append((chunk_filename, chunk_start, chunk_end))
            
            chunk_duration_min = (chunk_end - chunk_start) / (1000 * 60)
            print(f"📦 Created chunk {chunk_number}: {chunk_duration_min:.2f} minutes")
            
            chunk_start = chunk_end
            chunk_number += 1
        
        print(f"✅ Split audio into {len(chunks)} chunks")
        return chunks
    
    def process_and_upload(self, audio_file_path, project_name=None):
        """Complete workflow: chunk audio and upload to Drive"""
        if project_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = f"audio_chunks_{timestamp}"
        
        print(f"🎙️  PROCESSING AUDIO: {os.path.basename(audio_file_path)}")
        print("=" * 60)
        
        # Create folder in Google Drive
        print("📁 Creating Google Drive folder...")
        folder_id = self.create_drive_folder(project_name)
        folder_url = f"https://drive.google.com/drive/folders/{folder_id}"
        print(f"✅ Created folder: {project_name}")
        print(f"📂 Folder URL: {folder_url}")
        
        # Split audio into chunks
        chunks = self.split_audio(audio_file_path)
        
        # Upload chunks to Google Drive
        print("\n🔄 Uploading chunks to Google Drive...")
        uploaded_files = []
        
        for i, (chunk_path, start_ms, end_ms) in enumerate(chunks):
            chunk_name = f"chunk_{i+1:03d}.mp3"
            print(f"📤 Uploading {chunk_name}...")
            
            file_id = self.upload_to_drive(chunk_path, folder_id, chunk_name)
            
            start_time = str(timedelta(milliseconds=start_ms)).split('.')[0]
            end_time = str(timedelta(milliseconds=end_ms)).split('.')[0]
            
            uploaded_files.append({
                'name': chunk_name,
                'file_id': file_id,
                'start_time': start_time,
                'end_time': end_time,
                'duration_minutes': (end_ms - start_ms) / (1000 * 60)
            })
            
            # Clean up temporary file
            if chunk_path != audio_file_path:
                os.remove(chunk_path)
        
        print(f"\n✅ Successfully uploaded {len(uploaded_files)} chunks!")
        
        return {
            'project_name': project_name,
            'folder_id': folder_id,
            'folder_url': folder_url,
            'total_chunks': len(uploaded_files),
            'files': uploaded_files
        }

# Initialize the chunker
chunker = AudioChunker(chunk_duration_minutes=25)
print("🎵 Audio Chunker initialized!")
```

### Cell 5: Upload Audio File
```python
# Upload your audio file
print("📤 Please upload your audio file:")
print("Supported formats: MP3, WAV, M4A, FLAC, OGG")
print("⚠️  Note: Large files may take several minutes to upload")

uploaded = files.upload()

if uploaded:
    audio_filename = list(uploaded.keys())[0]
    audio_path = f"/content/{audio_filename}"
    print(f"✅ Audio file uploaded: {audio_filename}")
    
    # Get file size
    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
    print(f"📏 File size: {file_size_mb:.2f} MB")
else:
    print("❌ No file uploaded")
    audio_path = None
```

### Cell 6: Process and Upload
```python
# Process and upload audio chunks
if audio_path:
    # Optional: Customize project name
    project_name = input("Enter project name (or press Enter for auto-generated): ").strip()
    if not project_name:
        project_name = None
    
    # Process the audio
    result = chunker.process_and_upload(audio_path, project_name)
    
    # Display results
    print("\n🎉 PROCESSING COMPLETE!")
    print("=" * 50)
    print(f"📁 Project: {result['project_name']}")
    print(f"📂 Folder ID: {result['folder_id']}")
    print(f"🔗 Folder URL: {result['folder_url']}")
    print(f"📦 Total chunks: {result['total_chunks']}")
    
    print("\n📋 Chunk Details:")
    for i, file_info in enumerate(result['files'], 1):
        print(f"  {i}. {file_info['name']} ({file_info['duration_minutes']:.1f} min)")
        print(f"     Time: {file_info['start_time']} - {file_info['end_time']}")
        print(f"     File ID: {file_info['file_id']}")
    
    # Save results for reference
    results_filename = f"results_{result['project_name']}.json"
    with open(results_filename, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\n💾 Results saved to: {results_filename}")
    
    # Store for next cell
    folder_id = result['folder_id']
    file_ids = [f['file_id'] for f in result['files']]
    
else:
    print("❌ No audio file to process")
```

### Cell 7: Generate Apps Script Code
```python
# Generate Apps Script code
if 'folder_id' in locals():
    print("🔧 GENERATING APPS SCRIPT CODE")
    print("=" * 40)
    
    apps_script_code = f'''/**
 * Auto-generated Apps Script function for your audio transcription
 * Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
 * Project: {result['project_name']}
 * Total chunks: {result['total_chunks']}
 */

function transcribeMyAudio() {{
  // Your Google Drive folder ID (auto-generated)
  const folderId = '{folder_id}';
  
  console.log('🎵 Starting transcription for {result["project_name"]}');
  console.log('📁 Folder ID: ' + folderId);
  
  // Run transcription
  const result = transcribeFolderContents(folderId);
  
  if (result.success) {{
    console.log('✅ Transcription completed successfully!');
    console.log('📝 Total words: ' + result.totalWords.toLocaleString());
    console.log('⏱️  Processing time: ' + result.totalProcessingTime.toFixed(2) + 's');
  }} else {{
    console.log('❌ Transcription failed: ' + result.error);
  }}
  
  return result;
}}

// Alternative: Transcribe specific files by ID
function transcribeSpecificFiles() {{
  const fileIds = [
    {chr(10).join([f"    '{fid}',  // {result['files'][i]['name']}" for i, fid in enumerate(file_ids)])}
  ];
  
  return transcribeAudioChunks(fileIds);
}}'''
    
    print("📋 COPY THIS CODE TO YOUR APPS SCRIPT:")
    print("=" * 50)
    print(apps_script_code)
    print("=" * 50)
    
    # Save the Apps Script code
    with open(f"apps_script_code_{result['project_name']}.js", 'w') as f:
        f.write(apps_script_code)
    
    print(f"\n💾 Apps Script code saved to: apps_script_code_{result['project_name']}.js")
    
    # Download the code file
    print("\n📥 Downloading Apps Script code...")
    files.download(f"apps_script_code_{result['project_name']}.js")
    
else:
    print("❌ No folder ID available - please run the previous cells first")
```

### Cell 8: Final Instructions
```python
# Final instructions
if 'folder_id' in locals():
    print("🎯 NEXT STEPS:")
    print("=" * 30)
    print("1. ✅ Your audio has been chunked and uploaded to Google Drive")
    print("2. 📋 Copy the generated Apps Script code above")
    print("3. 🔗 Go to script.google.com and create a new project")
    print("4. 📝 Paste the main transcriber code + your generated function")
    print("5. 🔑 Set your GOOGLE_API_KEY in Script Properties")
    print("6. 🚀 Run transcribeMyAudio() to start transcription")
    
    print("\n📂 YOUR RESOURCES:")
    print(f"   • Folder ID: {folder_id}")
    print(f"   • Folder URL: {result['folder_url']}")
    print(f"   • Total chunks: {result['total_chunks']}")
    
    print("\n🎉 You're all set! Happy transcribing!")
    
else:
    print("❌ Please run all cells above first to process your audio")
```

---

## 📋 Part 2: Fresh Apps Script Transcriber

### Step 1: Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Replace the default code with the complete code below

### Step 2: Complete Apps Script Code

```javascript
/**
 * Fresh Audio Transcription System - Apps Script Component
 * Integrates with Google Colab for audio chunking
 * 
 * Setup:
 * 1. Set GOOGLE_API_KEY in Script Properties
 * 2. Enable Drive API in Services
 * 3. Use folder ID from Colab processing
 */

class EnhancedGeminiTranscriber {
  constructor() {
    this.apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_API_KEY');
    if (!this.apiKey) {
      throw new Error('❌ GOOGLE_API_KEY not found in script properties');
    }
    
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-2.0-flash-exp';
    this.maxRetries = 3;
    this.retryDelayMs = 5000;
  }

  /**
   * Upload audio file to Gemini API with retry logic
   */
  uploadAudioToGemini(audioBlob, mimeType, fileName) {
    const uploadUrl = `${this.baseUrl}/files`;
    
    const metadata = {
      file: {
        display_name: fileName || `audio_chunk_${Date.now()}`,
        mime_type: mimeType
      }
    };
    
    // Initial upload request
    const response = UrlFetchApp.fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(metadata)
    });
    
    const responseData = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Upload initialization failed: ${responseData.error.message}`);
    }
    
    // Upload the actual file data
    const fileUri = responseData.file.uri;
    const fileId = fileUri.split('/').pop();
    const uploadDataUrl = `${this.baseUrl}/files/${fileId}:upload`;
    
    const uploadResponse = UrlFetchApp.fetch(uploadDataUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': mimeType
      },
      payload: audioBlob.getBytes()
    });
    
    if (uploadResponse.getResponseCode() !== 200) {
      throw new Error(`File upload failed: ${uploadResponse.getContentText()}`);
    }
    
    return fileUri;
  }

  /**
   * Wait for file processing with enhanced status checking
   */
  waitForProcessing(fileUri) {
    const maxAttempts = 60; // 5 minutes total
    const delayMs = 5000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const fileId = fileUri.split('/').pop();
      const statusUrl = `${this.baseUrl}/files/${fileId}`;
      
      const response = UrlFetchApp.fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const fileData = JSON.parse(response.getContentText());
      
      console.log(`⏳ Processing attempt ${attempt + 1}/${maxAttempts}: ${fileData.state}`);
      
      if (fileData.state === 'ACTIVE') {
        return true;
      } else if (fileData.state === 'FAILED') {
        throw new Error(`File processing failed: ${fileData.error || 'Unknown error'}`);
      }
      
      // Wait before next check
      Utilities.sleep(delayMs);
    }
    
    throw new Error('File processing timeout after 5 minutes');
  }

  /**
   * Generate transcription with enhanced prompting
   */
  generateTranscription(fileUri, chunkIndex, totalChunks, fileName) {
    const generateUrl = `${this.baseUrl}/models/${this.model}:generateContent`;
    
    const prompt = `Please transcribe this audio chunk accurately. This is part ${chunkIndex + 1} of ${totalChunks} from a religious/biblical teaching (${fileName}).

CRITICAL INSTRUCTIONS:
- Provide ONLY the complete transcript text for this audio segment
- Include proper punctuation and capitalization
- Organize into natural paragraphs where breaks occur
- If this chunk starts mid-sentence (not chunk 1), begin naturally without indicating continuation
- If this chunk ends mid-sentence (not final chunk), end naturally without indicating continuation
- Do NOT add commentary, analysis, or chunk references
- For unclear sections, use [unclear] notation
- For long pauses (3+ seconds), use two empty lines (double line break)
- For natural pauses, use normal paragraph breaks
- Do NOT use [pause] notation

TRANSCRIPT:`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { file_data: { mime_type: "audio/mp3", file_uri: fileUri } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      }
    };
    
    const response = UrlFetchApp.fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(requestBody)
    });
    
    const responseData = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Transcription failed: ${responseData.error.message}`);
    }
    
    return responseData.candidates[0].content.parts[0].text;
  }

  /**
   * Delete uploaded file from Gemini API
   */
  deleteUploadedFile(fileUri) {
    try {
      const fileId = fileUri.split('/').pop();
      const deleteUrl = `${this.baseUrl}/files/${fileId}`;
      
      UrlFetchApp.fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
    } catch (error) {
      console.warn(`⚠️ Could not delete file ${fileUri}: ${error.message}`);
    }
  }

  /**
   * Transcribe a single chunk with enhanced error handling
   */
  transcribeChunk(fileId, chunkIndex, totalChunks) {
    const startTime = Date.now();
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`🎵 Transcribing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${attempt + 1}/${this.maxRetries})`);
        
        // Get file from Google Drive
        const file = DriveApp.getFileById(fileId);
        const audioBlob = file.getBlob();
        const mimeType = file.getBlob().getContentType();
        const fileName = file.getName();
        
        console.log(`📁 Processing file: ${fileName}`);
        console.log(`📏 File size: ${(audioBlob.getBytes().length / 1024 / 1024).toFixed(2)} MB`);
        
        // Upload to Gemini
        console.log(`🔄 Uploading to Gemini...`);
        const fileUri = this.uploadAudioToGemini(audioBlob, mimeType, fileName);
        
        // Wait for processing
        console.log(`⏳ Waiting for processing...`);
        this.waitForProcessing(fileUri);
        
        // Generate transcription
        console.log(`🤖 Generating transcription...`);
        const transcript = this.generateTranscription(fileUri, chunkIndex, totalChunks, fileName);
        
        // Clean up
        this.deleteUploadedFile(fileUri);
        
        const processingTime = (Date.now() - startTime) / 1000;
        const wordCount = transcript.split(/\s+/).filter(word => word.length > 0).length;
        
        console.log(`✅ Chunk ${chunkIndex + 1} completed in ${processingTime.toFixed(2)}s`);
        console.log(`📝 Words transcribed: ${wordCount}`);
        
        return {
          success: true,
          transcript: transcript.trim(),
          chunkIndex: chunkIndex,
          fileName: fileName,
          processingTime: processingTime,
          wordCount: wordCount,
          attempt: attempt + 1,
          error: null
        };
        
      } catch (error) {
        const errorMessage = error.message;
        console.error(`❌ Chunk ${chunkIndex + 1} attempt ${attempt + 1} failed: ${errorMessage}`);
        
        if (attempt === this.maxRetries - 1) {
          return {
            success: false,
            transcript: '',
            chunkIndex: chunkIndex,
            fileName: file ? file.getName() : 'unknown',
            processingTime: (Date.now() - startTime) / 1000,
            wordCount: 0,
            attempt: attempt + 1,
            error: errorMessage
          };
        }
        
        // Wait before retry
        console.log(`⏳ Waiting ${this.retryDelayMs/1000}s before retry...`);
        Utilities.sleep(this.retryDelayMs);
      }
    }
  }

  /**
   * Transcribe multiple chunks with progress tracking
   */
  transcribeMultipleChunks(fileIds) {
    console.log("🎙️  ENHANCED GEMINI TRANSCRIPTION SYSTEM");
    console.log("=" * 60);
    
    const overallStartTime = Date.now();
    const results = [];
    
    for (let i = 0; i < fileIds.length; i++) {
      const progress = Math.round((i / fileIds.length) * 100);
      console.log(`\n📊 Progress: ${progress}% (${i}/${fileIds.length})`);
      
      const result = this.transcribeChunk(fileIds[i], i, fileIds.length);
      results.push(result);
      
      // Progress update
      if (result.success) {
        console.log(`✅ Chunk ${i + 1} SUCCESS`);
      } else {
        console.log(`❌ Chunk ${i + 1} FAILED: ${result.error}`);
      }
      
      // Delay between chunks
      if (i < fileIds.length - 1) {
        console.log("⏳ Waiting 3 seconds before next chunk...");
        Utilities.sleep(3000);
      }
    }
    
    // Process results
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const fullTranscript = successfulResults
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(r => r.transcript)
      .join('\n\n');
    
    const totalWords = successfulResults.reduce((sum, r) => sum + r.wordCount, 0);
    const totalProcessingTime = (Date.now() - overallStartTime) / 1000;
    
    return {
      success: successfulResults.length > 0,
      transcript: fullTranscript,
      totalChunks: fileIds.length,
      successfulChunks: successfulResults.length,
      failedChunks: failedResults.length,
      totalWords: totalWords,
      totalProcessingTime: totalProcessingTime,
      averageWordsPerMinute: totalWords / (totalProcessingTime / 60),
      chunkResults: results
    };
  }
}

// Main transcription functions

function transcribeAudioChunks(fileIds) {
  try {
    const transcriber = new EnhancedGeminiTranscriber();
    const result = transcriber.transcribeMultipleChunks(fileIds);
    
    console.log("\n🎉 TRANSCRIPTION SUMMARY");
    console.log("=" * 50);
    console.log(`⏱️  Total processing time: ${result.totalProcessingTime.toFixed(2)} seconds`);
    console.log(`📦 Total chunks: ${result.totalChunks}`);
    console.log(`✅ Successful chunks: ${result.successfulChunks}`);
    console.log(`❌ Failed chunks: ${result.failedChunks}`);
    console.log(`📝 Total words: ${result.totalWords.toLocaleString()}`);
    console.log(`🏃 Average speed: ${result.averageWordsPerMinute.toFixed(1)} words/minute`);
    
    if (result.success) {
      // Save enhanced transcript
      const transcriptContent = createEnhancedTranscript(result);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const transcriptFileName = `enhanced_transcript_${timestamp}.txt`;
      
      const transcriptFile = DriveApp.createFile(transcriptFileName, transcriptContent);
      console.log(`💾 Enhanced transcript saved: ${transcriptFile.getName()}`);
      console.log(`📂 File ID: ${transcriptFile.getId()}`);
      
      return result;
    } else {
      console.log("❌ All chunks failed to process");
      return result;
    }
    
  } catch (error) {
    console.error(`❌ System error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function createEnhancedTranscript(result) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  let content = "═".repeat(80) + "\n";
  content += "🎵 ENHANCED GEMINI TRANSCRIPTION SYSTEM\n";
  content += "═".repeat(80) + "\n";
  content += `📅 Generated: ${timestamp}\n`;
  content += `⏱️  Processing Time: ${result.totalProcessingTime.toFixed(2)} seconds\n`;
  content += `📦 Total Chunks: ${result.totalChunks}\n`;
  content += `✅ Successful: ${result.successfulChunks}\n`;
  content += `❌ Failed: ${result.failedChunks}\n`;
  content += `📝 Total Words: ${result.totalWords.toLocaleString()}\n`;
  content += `🏃 Processing Speed: ${result.averageWordsPerMinute.toFixed(1)} words/minute\n`;
  content += "═".repeat(80) + "\n\n";
  
  // Main transcript
  content += "📜 FULL TRANSCRIPT\n";
  content += "─".repeat(40) + "\n\n";
  content += result.transcript;
  
  // Detailed chunk analysis
  content += "\n\n" + "═".repeat(80) + "\n";
  content += "📊 CHUNK PROCESSING ANALYSIS\n";
  content += "═".repeat(80) + "\n";
  
  result.chunkResults.forEach((chunk, index) => {
    content += `\n📦 Chunk ${index + 1}:\n`;
    content += `   📁 File: ${chunk.fileName}\n`;
    content += `   📊 Status: ${chunk.success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
    content += `   ⏱️  Processing Time: ${chunk.processingTime.toFixed(2)}s\n`;
    content += `   📝 Word Count: ${chunk.wordCount.toLocaleString()}\n`;
    content += `   🔄 Attempts: ${chunk.attempt}\n`;
    
    if (!chunk.success) {
      content += `   ❌ Error: ${chunk.error}\n`;
    }
  });
  
  return content;
}

function getFileIdsFromFolder(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const fileIds = [];
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    
    // Include audio files
    if (name.match(/\.(mp3|wav|m4a|flac|ogg|aac)$/i)) {
      fileIds.push(file.getId());
    }
  }
  
  // Sort by filename for correct order
  fileIds.sort((a, b) => {
    const fileA = DriveApp.getFileById(a).getName();
    const fileB = DriveApp.getFileById(b).getName();
    return fileA.localeCompare(fileB);
  });
  
  return fileIds;
}

function transcribeFolderContents(folderId) {
  const fileIds = getFileIdsFromFolder(folderId);
  console.log(`📁 Found ${fileIds.length} audio files in folder`);
  
  if (fileIds.length === 0) {
    console.log("❌ No audio files found in the specified folder");
    return { success: false, error: "No audio files found" };
  }
  
  return transcribeAudioChunks(fileIds);
}

// Test and utility functions

function testSetup() {
  try {
    const transcriber = new EnhancedGeminiTranscriber();
    console.log("✅ Setup successful!");
    console.log("🔑 API key found");
    console.log("🤖 Model: " + transcriber.model);
    console.log("🔄 Max retries: " + transcriber.maxRetries);
    return true;
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    console.log("💡 Check that GOOGLE_API_KEY is set in Script Properties");
    return false;
  }
}

function getGoogleDriveInfo() {
  const user = Session.getActiveUser().getEmail();
  console.log(`👤 Authenticated as: ${user}`);
  console.log(`📱 Available services: Drive API`);
  return { user: user, services: ['Drive API'] };
}

// Example usage function (replace with your actual folder ID)
function exampleTranscription() {
  const folderId = 'YOUR_FOLDER_ID_FROM_COLAB'; // Replace with actual folder ID
  
  if (folderId === 'YOUR_FOLDER_ID_FROM_COLAB') {
    console.log("❌ Please replace 'YOUR_FOLDER_ID_FROM_COLAB' with your actual folder ID");
    return;
  }
  
  const result = transcribeFolderContents(folderId);
  return result;
}
```

## 🚀 Usage Instructions

### Step 1: Process Audio in Colab
1. Open the Colab notebook
2. Run all cells in order
3. Upload your audio file
4. Get the folder ID from the output

### Step 2: Setup Apps Script
1. Go to script.google.com
2. Create new project
3. Paste the Apps Script code
4. Set `GOOGLE_API_KEY` in Script Properties
5. Enable Drive API

### Step 3: Run Transcription
1. Replace `YOUR_FOLDER_ID_FROM_COLAB` with your actual folder ID
2. Run `exampleTranscription()` or use the generated function from Colab

## 🎯 Features

### Colab Features:
- ✅ Automatic audio chunking (25-minute segments)
- ✅ Direct Google Drive upload
- ✅ Progress tracking
- ✅ Automatic Apps Script code generation
- ✅ Support for all audio formats

### Apps Script Features:
- ✅ Enhanced error handling with retries
- ✅ Progress tracking and detailed logging
- ✅ Automatic file cleanup
- ✅ Rich transcript formatting
- ✅ Processing analytics
- ✅ Seamless Google Drive integration

## 🔧 Customization

### Colab Customization:
- Change chunk duration in `AudioChunker(chunk_duration_minutes=25)`
- Modify folder naming in `create_drive_folder()`
- Adjust audio quality in `chunk_audio.export()`

### Apps Script Customization:
- Modify retry logic in `maxRetries` and `retryDelayMs`
- Customize transcription prompt in `generateTranscription()`
- Adjust processing delays in `transcribeMultipleChunks()`

This system gives you the best of both worlds: powerful audio processing in Colab and seamless transcription in Apps Script!