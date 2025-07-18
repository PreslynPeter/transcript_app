/**
 * Google Apps Script Audio Transcriber
 * Converted from Python ChunkedAudioTranscriber
 * 
 * Setup Instructions:
 * 1. Copy this entire code to a new Google Apps Script project
 * 2. Set GOOGLE_API_KEY in Project Settings > Script Properties
 * 3. Enable Drive API in Services
 * 4. Pre-split your audio into 25-minute chunks and upload to Google Drive
 * 5. Use the functions below to transcribe your audio
 */

class GeminiAudioTranscriber {
  constructor() {
    this.apiKey = PropertiesService.getScriptProperties().getProperty('GOOGLE_API_KEY');
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY not found in script properties');
    }
    
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-2.0-flash-exp';
  }

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

  transcribeChunk(fileId, chunkIndex, totalChunks) {
    const startTime = Date.now();
    
    try {
      console.log(`🎵 Transcribing chunk ${chunkIndex + 1}/${totalChunks}`);
      
      const file = DriveApp.getFileById(fileId);
      const audioBlob = file.getBlob();
      const mimeType = file.getBlob().getContentType();
      
      console.log(`🔄 Uploading chunk to Gemini...`);
      const fileUri = this.uploadAudioToGemini(audioBlob, mimeType);
      
      console.log(`⏳ Waiting for processing...`);
      this.waitForProcessing(fileUri);
      
      console.log(`🤖 Generating transcription...`);
      const transcript = this.generateTranscription(fileUri, chunkIndex, totalChunks);
      
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

  transcribeMultipleChunks(fileIds) {
    console.log("🎙️  GEMINI TRANSCRIPTION WITH GOOGLE APPS SCRIPT");
    console.log("=".repeat(60));
    
    const overallStartTime = Date.now();
    const results = [];
    
    for (let i = 0; i < fileIds.length; i++) {
      const result = this.transcribeChunk(fileIds[i], i, fileIds.length);
      results.push(result);
      
      if (i < fileIds.length - 1) {
        console.log("⏳ Waiting 2 seconds before next chunk...");
        Utilities.sleep(2000);
      }
    }
    
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

// Main Functions

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
  
  content += result.transcript;
  
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

function getFileIdsFromFolder(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const fileIds = [];
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    
    if (name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)) {
      fileIds.push(file.getId());
    }
  }
  
  fileIds.sort((a, b) => {
    const fileA = DriveApp.getFileById(a).getName();
    const fileB = DriveApp.getFileById(b).getName();
    return fileA.localeCompare(fileB);
  });
  
  return fileIds;
}

function transcribeFolderContents(folderId) {
  const fileIds = getFileIdsFromFolder(folderId);
  console.log(`Found ${fileIds.length} audio files in folder`);
  
  if (fileIds.length === 0) {
    console.log("No audio files found in the specified folder");
    return { success: false, error: "No audio files found" };
  }
  
  return transcribeAudioChunks(fileIds);
}

// Usage Examples

/**
 * Example 1: Transcribe all audio files in a Google Drive folder
 * Replace 'YOUR_FOLDER_ID' with actual folder ID from Google Drive URL
 */
function exampleTranscribeFolder() {
  const folderId = 'YOUR_FOLDER_ID'; // Replace with actual folder ID
  const result = transcribeFolderContents(folderId);
  
  if (result.success) {
    console.log("Transcription completed successfully!");
    console.log(`Total words: ${result.totalWords}`);
  } else {
    console.log("Transcription failed:", result.error);
  }
  
  return result;
}

/**
 * Example 2: Transcribe specific audio files by their Google Drive IDs
 * Replace with actual file IDs from Google Drive
 */
function exampleTranscribeSpecificFiles() {
  const fileIds = [
    'YOUR_FILE_ID_1', // Replace with actual file ID
    'YOUR_FILE_ID_2', // Replace with actual file ID
    'YOUR_FILE_ID_3'  // Replace with actual file ID
  ];
  
  const result = transcribeAudioChunks(fileIds);
  return result;
}

/**
 * Test function to verify setup
 */
function testSetup() {
  try {
    const transcriber = new GeminiAudioTranscriber();
    console.log("✅ Setup successful! API key found and transcriber initialized.");
    return true;
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    console.log("Please check that you've set GOOGLE_API_KEY in Script Properties");
    return false;
  }
}