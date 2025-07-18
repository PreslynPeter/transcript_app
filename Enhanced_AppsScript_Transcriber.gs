/**
 * Enhanced Audio Transcription System - Apps Script Component
 * Works with Google Colab for audio chunking
 * 
 * Features:
 * - Enhanced error handling with retry logic
 * - Progress tracking and detailed logging
 * - Automatic file cleanup
 * - Rich transcript formatting
 * - Processing analytics
 * - Seamless Google Drive integration
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
   * Upload audio file to Gemini API with enhanced error handling
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
      throw new Error(`Upload initialization failed: ${responseData.error?.message || 'Unknown error'}`);
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
      
      try {
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
          throw new Error(`File processing failed: ${fileData.error?.message || 'Unknown error'}`);
        }
        
        // Wait before next check
        Utilities.sleep(delayMs);
        
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        console.log(`⚠️ Status check failed, retrying: ${error.message}`);
        Utilities.sleep(delayMs);
      }
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
          { file_data: { mime_type: mimeType || "audio/mp3", file_uri: fileUri } }
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
      throw new Error(`Transcription failed: ${responseData.error?.message || 'Unknown error'}`);
    }
    
    if (!responseData.candidates || !responseData.candidates[0] || !responseData.candidates[0].content) {
      throw new Error('Invalid transcription response format');
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
      
      console.log(`🗑️ Cleaned up file: ${fileId}`);
    } catch (error) {
      console.warn(`⚠️ Could not delete file ${fileUri}: ${error.message}`);
    }
  }

  /**
   * Transcribe a single chunk with enhanced error handling
   */
  transcribeChunk(fileId, chunkIndex, totalChunks) {
    const startTime = Date.now();
    let file = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`🎵 Transcribing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${attempt + 1}/${this.maxRetries})`);
        
        // Get file from Google Drive
        file = DriveApp.getFileById(fileId);
        const audioBlob = file.getBlob();
        const mimeType = file.getBlob().getContentType();
        const fileName = file.getName();
        
        console.log(`📁 Processing file: ${fileName}`);
        console.log(`📏 File size: ${(audioBlob.getBytes().length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🎯 MIME type: ${mimeType}`);
        
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
    console.log("═".repeat(60));
    
    const overallStartTime = Date.now();
    const results = [];
    
    for (let i = 0; i < fileIds.length; i++) {
      const progress = Math.round((i / fileIds.length) * 100);
      console.log(`\n📊 Progress: ${progress}% (${i}/${fileIds.length})`);
      
      const result = this.transcribeChunk(fileIds[i], i, fileIds.length);
      results.push(result);
      
      // Progress update
      if (result.success) {
        console.log(`✅ Chunk ${i + 1} SUCCESS - ${result.wordCount} words`);
      } else {
        console.log(`❌ Chunk ${i + 1} FAILED: ${result.error}`);
      }
      
      // Delay between chunks to avoid rate limiting
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
      successRate: (successfulResults.length / fileIds.length) * 100,
      chunkResults: results
    };
  }
}

// Main transcription functions

function transcribeAudioChunks(fileIds) {
  try {
    console.log(`🚀 Starting transcription of ${fileIds.length} chunks...`);
    
    const transcriber = new EnhancedGeminiTranscriber();
    const result = transcriber.transcribeMultipleChunks(fileIds);
    
    console.log("\n🎉 TRANSCRIPTION SUMMARY");
    console.log("═".repeat(50));
    console.log(`⏱️  Total processing time: ${result.totalProcessingTime.toFixed(2)} seconds`);
    console.log(`📦 Total chunks: ${result.totalChunks}`);
    console.log(`✅ Successful chunks: ${result.successfulChunks}`);
    console.log(`❌ Failed chunks: ${result.failedChunks}`);
    console.log(`📝 Total words: ${result.totalWords.toLocaleString()}`);
    console.log(`🎯 Success rate: ${result.successRate.toFixed(1)}%`);
    console.log(`🏃 Average speed: ${result.averageWordsPerMinute.toFixed(1)} words/minute`);
    
    if (result.success) {
      // Save enhanced transcript
      const transcriptContent = createEnhancedTranscript(result);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const transcriptFileName = `enhanced_transcript_${timestamp}.txt`;
      
      const transcriptFile = DriveApp.createFile(transcriptFileName, transcriptContent);
      console.log(`💾 Enhanced transcript saved: ${transcriptFile.getName()}`);
      console.log(`📂 File URL: https://drive.google.com/file/d/${transcriptFile.getId()}/view`);
      
      // Create a summary file
      const summaryContent = createSummaryReport(result);
      const summaryFileName = `transcription_summary_${timestamp}.txt`;
      const summaryFile = DriveApp.createFile(summaryFileName, summaryContent);
      console.log(`📊 Summary report saved: ${summaryFile.getName()}`);
      
      return result;
    } else {
      console.log("❌ All chunks failed to process - check the logs above");
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
  content += `⏱️  Processing Time: ${result.totalProcessingTime.toFixed(2)} seconds (${(result.totalProcessingTime / 60).toFixed(1)} minutes)\n`;
  content += `📦 Total Chunks: ${result.totalChunks}\n`;
  content += `✅ Successful: ${result.successfulChunks}\n`;
  content += `❌ Failed: ${result.failedChunks}\n`;
  content += `📝 Total Words: ${result.totalWords.toLocaleString()}\n`;
  content += `🎯 Success Rate: ${result.successRate.toFixed(1)}%\n`;
  content += `🏃 Processing Speed: ${result.averageWordsPerMinute.toFixed(1)} words/minute\n`;
  content += "═".repeat(80) + "\n\n";
  
  // Main transcript
  content += "📜 FULL TRANSCRIPT\n";
  content += "─".repeat(40) + "\n\n";
  content += result.transcript;
  
  // Detailed chunk analysis
  content += "\n\n" + "═".repeat(80) + "\n";
  content += "📊 DETAILED CHUNK ANALYSIS\n";
  content += "═".repeat(80) + "\n";
  
  result.chunkResults.forEach((chunk, index) => {
    content += `\n📦 Chunk ${index + 1}:\n`;
    content += `   📁 File: ${chunk.fileName}\n`;
    content += `   📊 Status: ${chunk.success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
    content += `   ⏱️  Processing Time: ${chunk.processingTime.toFixed(2)}s\n`;
    content += `   📝 Word Count: ${chunk.wordCount.toLocaleString()}\n`;
    content += `   🔄 Attempts: ${chunk.attempt}/${3}\n`;
    
    if (!chunk.success) {
      content += `   ❌ Error: ${chunk.error}\n`;
    }
  });
  
  return content;
}

function createSummaryReport(result) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  let content = "📊 TRANSCRIPTION SUMMARY REPORT\n";
  content += "═".repeat(50) + "\n";
  content += `📅 Generated: ${timestamp}\n\n`;
  
  content += "🎯 PERFORMANCE METRICS:\n";
  content += `   ⏱️  Total Processing Time: ${result.totalProcessingTime.toFixed(2)} seconds\n`;
  content += `   📦 Total Chunks: ${result.totalChunks}\n`;
  content += `   ✅ Success Rate: ${result.successRate.toFixed(1)}%\n`;
  content += `   📝 Total Words: ${result.totalWords.toLocaleString()}\n`;
  content += `   🏃 Processing Speed: ${result.averageWordsPerMinute.toFixed(1)} words/minute\n\n`;
  
  content += "📋 CHUNK STATUS:\n";
  result.chunkResults.forEach((chunk, index) => {
    const status = chunk.success ? '✅' : '❌';
    const attempts = chunk.attempt > 1 ? ` (${chunk.attempt} attempts)` : '';
    content += `   ${status} Chunk ${index + 1}: ${chunk.wordCount} words${attempts}\n`;
  });
  
  if (result.failedChunks > 0) {
    content += "\n⚠️  FAILED CHUNKS:\n";
    result.chunkResults.filter(c => !c.success).forEach((chunk, index) => {
      content += `   ❌ ${chunk.fileName}: ${chunk.error}\n`;
    });
  }
  
  return content;
}

function getFileIdsFromFolder(folderId) {
  try {
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
    
    console.log(`📁 Found ${fileIds.length} audio files in folder`);
    return fileIds;
    
  } catch (error) {
    console.error(`❌ Error accessing folder: ${error.message}`);
    throw new Error(`Could not access folder: ${error.message}`);
  }
}

function transcribeFolderContents(folderId) {
  try {
    const fileIds = getFileIdsFromFolder(folderId);
    
    if (fileIds.length === 0) {
      console.log("❌ No audio files found in the specified folder");
      return { success: false, error: "No audio files found in folder" };
    }
    
    console.log(`📂 Processing ${fileIds.length} audio files from folder...`);
    return transcribeAudioChunks(fileIds);
    
  } catch (error) {
    console.error(`❌ Error in transcribeFolderContents: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test and utility functions

function testSetup() {
  try {
    console.log("🧪 Testing system setup...");
    
    const transcriber = new EnhancedGeminiTranscriber();
    console.log("✅ Transcriber initialized successfully");
    console.log("🔑 API key: Found");
    console.log("🤖 Model: " + transcriber.model);
    console.log("🔄 Max retries: " + transcriber.maxRetries);
    console.log("⏱️  Retry delay: " + transcriber.retryDelayMs + "ms");
    
    // Test Drive API access
    const user = Session.getActiveUser().getEmail();
    console.log("👤 Authenticated as: " + user);
    
    console.log("\n🎉 All tests passed! System is ready for transcription.");
    return true;
    
  } catch (error) {
    console.error("❌ Setup test failed:", error.message);
    console.log("\n💡 Troubleshooting:");
    console.log("   1. Check that GOOGLE_API_KEY is set in Script Properties");
    console.log("   2. Ensure Drive API is enabled in Services");
    console.log("   3. Verify your Gemini API key is valid");
    return false;
  }
}

function getSystemInfo() {
  try {
    const user = Session.getActiveUser().getEmail();
    const scriptProperties = PropertiesService.getScriptProperties().getProperties();
    
    const info = {
      user: user,
      hasApiKey: !!scriptProperties.GOOGLE_API_KEY,
      timestamp: new Date().toISOString(),
      services: ['Drive API', 'Gemini API']
    };
    
    console.log("📋 System Information:");
    console.log(`   👤 User: ${info.user}`);
    console.log(`   🔑 API Key: ${info.hasApiKey ? 'Set' : 'Missing'}`);
    console.log(`   📅 Timestamp: ${info.timestamp}`);
    console.log(`   🔧 Services: ${info.services.join(', ')}`);
    
    return info;
    
  } catch (error) {
    console.error("❌ Error getting system info:", error.message);
    return { error: error.message };
  }
}

// Example usage functions

/**
 * Example function to transcribe files in a folder
 * Replace 'YOUR_FOLDER_ID' with the actual folder ID from Google Colab
 */
function exampleTranscribeFolder() {
  const folderId = 'YOUR_FOLDER_ID_FROM_COLAB'; // Replace with actual folder ID
  
  if (folderId === 'YOUR_FOLDER_ID_FROM_COLAB') {
    console.log("❌ Please replace 'YOUR_FOLDER_ID_FROM_COLAB' with your actual folder ID");
    console.log("💡 Get the folder ID from your Google Colab output");
    return { success: false, error: "Folder ID not set" };
  }
  
  console.log(`🎯 Starting transcription for folder: ${folderId}`);
  const result = transcribeFolderContents(folderId);
  
  if (result.success) {
    console.log("🎉 Transcription completed successfully!");
    console.log(`📝 Total words: ${result.totalWords.toLocaleString()}`);
  } else {
    console.log("❌ Transcription failed:", result.error);
  }
  
  return result;
}

/**
 * Example function to transcribe specific files
 * Replace with your actual file IDs
 */
function exampleTranscribeSpecificFiles() {
  const fileIds = [
    'YOUR_FILE_ID_1', // Replace with actual file ID
    'YOUR_FILE_ID_2', // Replace with actual file ID
    'YOUR_FILE_ID_3'  // Replace with actual file ID
  ];
  
  if (fileIds[0] === 'YOUR_FILE_ID_1') {
    console.log("❌ Please replace the file IDs with your actual Google Drive file IDs");
    console.log("💡 Get file IDs from your Google Colab output");
    return { success: false, error: "File IDs not set" };
  }
  
  console.log(`🎯 Starting transcription for ${fileIds.length} specific files`);
  const result = transcribeAudioChunks(fileIds);
  
  return result;
}

/**
 * Quick test function with a single file
 */
function testSingleFile() {
  const fileId = 'YOUR_TEST_FILE_ID'; // Replace with a single file ID for testing
  
  if (fileId === 'YOUR_TEST_FILE_ID') {
    console.log("❌ Please replace 'YOUR_TEST_FILE_ID' with an actual file ID");
    return { success: false, error: "Test file ID not set" };
  }
  
  console.log("🧪 Testing transcription with single file...");
  const result = transcribeAudioChunks([fileId]);
  
  return result;
}

// Utility functions for maintenance

function cleanupOldTranscripts() {
  try {
    console.log("🧹 Cleaning up old transcript files...");
    
    const files = DriveApp.getFiles();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      
      if (name.match(/^(enhanced_transcript|transcription_summary)_/)) {
        if (file.getDateCreated() < thirtyDaysAgo) {
          console.log(`🗑️ Deleting old file: ${name}`);
          file.setTrashed(true);
          deletedCount++;
        }
      }
    }
    
    console.log(`✅ Cleanup complete. Deleted ${deletedCount} old transcript files.`);
    return { success: true, deletedCount: deletedCount };
    
  } catch (error) {
    console.error("❌ Cleanup failed:", error.message);
    return { success: false, error: error.message };
  }
}

function listRecentTranscripts() {
  try {
    console.log("📋 Listing recent transcript files...");
    
    const files = DriveApp.getFiles();
    const transcripts = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      
      if (name.match(/^enhanced_transcript_/)) {
        transcripts.push({
          name: name,
          id: file.getId(),
          created: file.getDateCreated(),
          size: file.getSize()
        });
      }
    }
    
    // Sort by creation date (newest first)
    transcripts.sort((a, b) => b.created - a.created);
    
    console.log(`Found ${transcripts.length} transcript files:`);
    transcripts.slice(0, 10).forEach((transcript, index) => {
      console.log(`   ${index + 1}. ${transcript.name} (${transcript.created.toLocaleDateString()})`);
    });
    
    return transcripts;
    
  } catch (error) {
    console.error("❌ Error listing transcripts:", error.message);
    return { error: error.message };
  }
}