# Converting Python Audio Transcriber to Google Apps Script

## Overview

Your Python audio transcription system uses Gemini AI to transcribe long audio files by chunking them into smaller segments. This guide shows how to convert it to Google Apps Script.

## Key Differences & Limitations

### Python vs Google Apps Script
- **Language**: Python → JavaScript
- **Audio Processing**: pydub library → External preprocessing required
- **File Handling**: Local files → Google Drive files
- **Execution Time**: No limits → 6-minute limit for functions
- **API Calls**: Python requests → UrlFetchApp service

### What You'll Need to Do Differently

1. **Audio Chunking**: Since Apps Script can't process audio directly, you'll need to:
   - Use external tools (Audacity, FFmpeg, etc.) to split long audio into 25-minute chunks
   - Upload chunks to Google Drive
   - Name them sequentially (e.g., `chunk_001.mp3`, `chunk_002.mp3`)

2. **File Management**: Work with Google Drive files instead of local files

3. **API Integration**: Use Apps Script's UrlFetchApp for Gemini API calls

## Complete Google Apps Script Implementation

### Step 1: Create the Main Script

```javascript
/**
 * Google Apps Script Audio Transcriber
 * Based on the Python ChunkedAudioTranscriber
 */

class GeminiAudioTranscriber {
  constructor() {
    // Get API key from Script Properties
    this.apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_API_KEY');
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY not found in script properties');
    }
    
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-2.0-flash-exp';
  }

  /**
   * Upload audio file to Gemini API
   */
  uploadAudioToGemini(audioBlob, mimeType) {
    const uploadUrl = `${this.baseUrl}/files`;
    
    const metadata = {
      file: {
        display_name: `audio_chunk_${Date.now()}`,
        mime_type: mimeType
      }
    };
    
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
      throw new Error(`Upload failed: ${responseData.error.message}`);
    }
    
    // Upload the actual file data
    const fileUri = responseData.file.uri;
    const uploadDataUrl = `${uploadUrl}/${fileUri.split('/').pop()}:upload`;
    
    UrlFetchApp.fetch(uploadDataUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': mimeType
      },
      payload: audioBlob.getBytes()
    });
    
    return fileUri;
  }

  /**
   * Wait for file processing to complete
   */
  waitForProcessing(fileUri) {
    const maxAttempts = 30;
    const delayMs = 5000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusUrl = `${this.baseUrl}/files/${fileUri.split('/').pop()}`;
      const response = UrlFetchApp.fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const fileData = JSON.parse(response.getContentText());
      
      if (fileData.state === 'ACTIVE') {
        return true;
      } else if (fileData.state === 'FAILED') {
        throw new Error('File processing failed');
      }
      
      Utilities.sleep(delayMs);
    }
    
    throw new Error('File processing timeout');
  }

  /**
   * Generate transcription using Gemini API
   */
  generateTranscription(fileUri, chunkIndex, totalChunks) {
    const generateUrl = `${this.baseUrl}/models/${this.model}:generateContent`;
    
    const prompt = `Please transcribe this audio chunk accurately. This is part ${chunkIndex + 1} of ${totalChunks} from a religious/biblical teaching.

Instructions:
- Provide the complete transcript text for this audio segment
- Include proper punctuation and capitalization
- Organize into paragraphs where natural breaks occur
- If this chunk starts mid-sentence (not chunk 1), begin naturally without indicating it's a continuation
- If this chunk ends mid-sentence (not the last chunk), end naturally without indicating it continues
- Do not add any commentary, analysis, or chunk number references
- If there are unclear sections, use [unclear] notation
- IMPORTANT: If there are long pauses (3+ seconds), replace them with two empty lines (double line break)
- For shorter natural pauses, use normal paragraph breaks
- Do not use [pause] notation - instead use the two empty lines for long pauses

Please provide only the transcript text for this audio segment.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          { file_data: { mime_type: "audio/mp3", file_uri: fileUri } }
        ]
      }]
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
      const deleteUrl = `${this.baseUrl}/files/${fileUri.split('/').pop()}`;
      UrlFetchApp.fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
    } catch (error) {
      console.log(`Warning: Could not delete file ${fileUri}: ${error.message}`);
    }
  }

  /**
   * Transcribe a single audio chunk
   */
  transcribeChunk(fileId, chunkIndex, totalChunks) {
    const startTime = Date.now();
    
    try {
      console.log(`🎵 Transcribing chunk ${chunkIndex + 1}/${totalChunks}`);
      
      // Get file from Google Drive
      const file = DriveApp.getFileById(fileId);
      const audioBlob = file.getBlob();
      const mimeType = file.getBlob().getContentType();
      
      console.log(`🔄 Uploading chunk to Gemini...`);
      const fileUri = this.uploadAudioToGemini(audioBlob, mimeType);
      
      console.log(`⏳ Waiting for processing...`);
      this.waitForProcessing(fileUri);
      
      console.log(`🤖 Generating transcription...`);
      const transcript = this.generateTranscription(fileUri, chunkIndex, totalChunks);
      
      // Clean up uploaded file
      this.deleteUploadedFile(fileUri);
      
      const processingTime = (Date.now() - startTime) / 1000;
      const wordCount = transcript.split(/\s+/).length;
      
      console.log(`✅ Chunk ${chunkIndex + 1} completed in ${processingTime.toFixed(2)}s`);
      console.log(`📝 Words transcribed: ${wordCount}`);
      
      return {
        success: true,
        transcript: transcript.trim(),
        chunkIndex: chunkIndex,
        processingTime: processingTime,
        wordCount: wordCount,
        error: null
      };
      
    } catch (error) {
      console.error(`❌ Chunk ${chunkIndex + 1} failed: ${error.message}`);
      return {
        success: false,
        transcript: '',
        chunkIndex: chunkIndex,
        processingTime: (Date.now() - startTime) / 1000,
        wordCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Transcribe multiple audio chunks
   */
  transcribeMultipleChunks(fileIds) {
    console.log("🎙️  GEMINI TRANSCRIPTION WITH GOOGLE APPS SCRIPT");
    console.log("=".repeat(60));
    
    const overallStartTime = Date.now();
    const results = [];
    
    for (let i = 0; i < fileIds.length; i++) {
      const result = this.transcribeChunk(fileIds[i], i, fileIds.length);
      results.push(result);
      
      // Small delay between chunks to avoid rate limiting
      if (i < fileIds.length - 1) {
        console.log("⏳ Waiting 2 seconds before next chunk...");
        Utilities.sleep(2000);
      }
    }
    
    // Merge successful transcriptions
    const successfulResults = results.filter(r => r.success);
    
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
      failedChunks: results.length - successfulResults.length,
      totalWords: totalWords,
      totalProcessingTime: totalProcessingTime,
      chunkResults: results
    };
  }
}
```

### Step 2: Main Functions

```javascript
/**
 * Main function to transcribe audio chunks
 */
function transcribeAudioChunks(fileIds) {
  try {
    const transcriber = new GeminiAudioTranscriber();
    const result = transcriber.transcribeMultipleChunks(fileIds);
    
    if (result.success) {
      console.log("\n✅ TRANSCRIPTION COMPLETED SUCCESSFULLY!");
      console.log(`⏱️  Total processing time: ${result.totalProcessingTime.toFixed(2)} seconds`);
      console.log(`📦 Total chunks processed: ${result.totalChunks}`);
      console.log(`✅ Successful chunks: ${result.successfulChunks}`);
      console.log(`❌ Failed chunks: ${result.failedChunks}`);
      console.log(`📝 Total words: ${result.totalWords.toLocaleString()}`);
      
      // Save transcript to Google Drive
      const transcriptFileName = `transcript_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      const transcriptContent = createTranscriptWithMetadata(result);
      
      const transcriptFile = DriveApp.createFile(transcriptFileName, transcriptContent);
      console.log(`💾 Transcript saved to Google Drive: ${transcriptFile.getName()}`);
      
      return result;
    } else {
      console.log("❌ TRANSCRIPTION FAILED!");
      return result;
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Create formatted transcript with metadata
 */
function createTranscriptWithMetadata(result) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  let content = "=".repeat(80) + "\n";
  content += "GEMINI TRANSCRIPTION WITH GOOGLE APPS SCRIPT\n";
  content += "=".repeat(80) + "\n";
  content += `Generated: ${timestamp}\n`;
  content += `Total Processing Time: ${result.totalProcessingTime.toFixed(2)} seconds\n`;
  content += `Total Chunks: ${result.totalChunks}\n`;
  content += `Successful Chunks: ${result.successfulChunks}\n`;
  content += `Failed Chunks: ${result.failedChunks}\n`;
  content += `Total Words: ${result.totalWords.toLocaleString()}\n`;
  content += "=".repeat(80) + "\n\n";
  
  // Main transcript
  content += result.transcript;
  
  // Chunk details
  content += "\n\n" + "=".repeat(80) + "\n";
  content += "CHUNK PROCESSING DETAILS\n";
  content += "=".repeat(80) + "\n";
  
  result.chunkResults.forEach((chunk, index) => {
    content += `\nChunk ${index + 1}:\n`;
    content += `  Status: ${chunk.success ? 'SUCCESS' : 'FAILED'}\n`;
    content += `  Processing Time: ${chunk.processingTime.toFixed(2)}s\n`;
    content += `  Word Count: ${chunk.wordCount}\n`;
    
    if (!chunk.success) {
      content += `  Error: ${chunk.error}\n`;
    }
  });
  
  return content;
}

/**
 * Helper function to get file IDs from a Google Drive folder
 */
function getFileIdsFromFolder(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const fileIds = [];
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    
    // Only include audio files
    if (name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)) {
      fileIds.push(file.getId());
    }
  }
  
  // Sort by filename to ensure correct order
  fileIds.sort((a, b) => {
    const fileA = DriveApp.getFileById(a).getName();
    const fileB = DriveApp.getFileById(b).getName();
    return fileA.localeCompare(fileB);
  });
  
  return fileIds;
}

/**
 * Convenience function to transcribe all audio files in a folder
 */
function transcribeFolderContents(folderId) {
  const fileIds = getFileIdsFromFolder(folderId);
  console.log(`Found ${fileIds.length} audio files in folder`);
  
  if (fileIds.length === 0) {
    console.log("No audio files found in the specified folder");
    return { success: false, error: "No audio files found" };
  }
  
  return transcribeAudioChunks(fileIds);
}
```

## Setup Instructions

### 1. Create Google Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Replace the default code with the implementation above
4. Save the project

### 2. Configure API Key
1. In your Apps Script project, go to **Project Settings** (gear icon)
2. Scroll down to **Script Properties**
3. Click **Add script property**
4. Property name: `GOOGLE_API_KEY`
5. Property value: Your Gemini API key
6. Click **Save**

### 3. Enable Required Services
1. In your Apps Script project, go to **Services** (+ icon in sidebar)
2. Add **Drive API**
3. Add **Docs API** (optional, for enhanced document creation)

### 4. Prepare Your Audio Files
Since Apps Script can't split audio files:

**Option A: Use Audacity (Free)**
1. Open your long audio file in Audacity
2. Use **Generate > Silence** to mark 25-minute intervals
3. Use **File > Export > Export Multiple** to save chunks
4. Upload chunks to Google Drive

**Option B: Use FFmpeg (Command Line)**
```bash
# Split audio into 25-minute chunks
ffmpeg -i input.mp3 -f segment -segment_time 1500 -c copy chunk_%03d.mp3
```

**Option C: Use Online Audio Splitters**
- Various online tools can split audio files
- Search for "audio splitter online"

### 5. Upload and Organize Files
1. Create a folder in Google Drive for your audio chunks
2. Upload your audio chunks (named sequentially)
3. Get the folder ID from the URL

## Usage Examples

### Example 1: Transcribe Files in a Folder
```javascript
function myTranscriptionJob() {
  // Replace with your Google Drive folder ID
  const folderId = '1ABC123DEF456GHI789';
  
  const result = transcribeFolderContents(folderId);
  
  if (result.success) {
    console.log("Transcription completed!");
    console.log(`Total words: ${result.totalWords}`);
  } else {
    console.log("Transcription failed:", result.error);
  }
}
```

### Example 2: Transcribe Specific Files
```javascript
function transcribeSpecificFiles() {
  // Replace with your actual Google Drive file IDs
  const fileIds = [
    '1ABC123_chunk1',
    '1DEF456_chunk2',
    '1GHI789_chunk3'
  ];
  
  const result = transcribeAudioChunks(fileIds);
  return result;
}
```

## Key Differences from Python Version

| Feature | Python Version | Apps Script Version |
|---------|----------------|-------------------|
| Audio Processing | pydub library | External preprocessing |
| File Handling | Local files | Google Drive files |
| API Calls | `requests` library | `UrlFetchApp` |
| Chunking | Automatic | Manual preprocessing |
| Execution Time | Unlimited | 6-minute limit |
| Error Handling | Python exceptions | JavaScript try/catch |
| Output | Local files | Google Drive files |

## Limitations & Considerations

1. **Manual Audio Chunking**: You must split audio files externally
2. **Execution Time**: 6-minute limit may require processing chunks in smaller batches
3. **File Size**: Google Drive and Apps Script have file size limits
4. **Rate Limiting**: Same API rate limits apply
5. **Debugging**: Use `console.log()` and the Apps Script execution transcript

## Tips for Success

1. **Test with Small Files First**: Start with 1-2 chunks to verify everything works
2. **Monitor Execution Time**: For many chunks, consider processing in batches
3. **Check File Formats**: Ensure your audio files are in supported formats
4. **Handle Errors Gracefully**: The script includes error handling for failed chunks
5. **Backup Your Work**: Save transcripts to Google Drive automatically

This Google Apps Script version maintains the core functionality of your Python transcriber while adapting to the Apps Script environment and limitations.