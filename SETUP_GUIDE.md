# 🎵 Complete Audio Transcription System Setup Guide

## Overview
This system processes long audio files by:
1. **Google Colab**: Splits audio into 25-minute chunks and uploads to Google Drive
2. **Google Apps Script**: Transcribes each chunk using Gemini AI
3. **Google Drive**: Seamlessly connects both systems

## 🚀 Part 1: Google Colab Setup (10 minutes)

### Step 1: Create Colab Notebook
1. Go to [Google Colab](https://colab.research.google.com)
2. Click **"New notebook"**
3. Rename it to "Audio Transcription System"

### Step 2: Copy and Run Colab Code
Copy each cell below into your Colab notebook and run them in order:

#### Cell 1: Install Dependencies
```python
# Install required packages
!pip install pydub google-colab-auth google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
!apt-get update &> /dev/null
!apt-get install ffmpeg &> /dev/null

print("✅ All packages installed successfully!")
```

#### Cell 2: Import Libraries
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

#### Cell 3: Authenticate Google Drive
```python
# Authenticate with Google Drive
auth.authenticate_user()
creds, _ = default()
drive_service = build('drive', 'v3', credentials=creds)

print("🔐 Google Drive authentication successful!")
```

#### Cell 4: Audio Processing Class
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

#### Cell 5: Upload Your Audio File
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

#### Cell 6: Process and Upload to Drive
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
    
    # Store for next cell
    folder_id = result['folder_id']
    file_ids = [f['file_id'] for f in result['files']]
    
    print(f"\n🔑 IMPORTANT - COPY THIS FOLDER ID:")
    print(f"📋 {folder_id}")
    print("👆 You'll need this for Apps Script!")
    
else:
    print("❌ No audio file to process")
```

#### Cell 7: Generate Apps Script Code
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
}}'''
    
    print("📋 COPY THIS CODE TO YOUR APPS SCRIPT:")
    print("=" * 50)
    print(apps_script_code)
    print("=" * 50)
    
    print(f"\n✅ Colab processing complete!")
    print(f"📂 Folder ID: {folder_id}")
    print(f"🔗 Folder URL: {result['folder_url']}")
    
else:
    print("❌ No folder ID available - please run the previous cells first")
```

---

## 🚀 Part 2: Google Apps Script Setup (5 minutes)

### Step 1: Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click **"New project"**
3. Replace all default code with the code below

### Step 2: Get Your Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the API key (keep it safe!)

### Step 3: Set Up Script Properties
1. In Apps Script, click the **Settings** (⚙️) icon
2. Scroll to **Script Properties**
3. Click **"Add script property"**
4. Name: `GOOGLE_API_KEY`
5. Value: Your Gemini API key
6. Click **Save**

### Step 4: Enable Drive API
1. In Apps Script, click **Services** (+ icon)
2. Find and add **"Google Drive API"**
3. Click **Save**

---

## 🎯 Next Steps

1. **Run Colab cells** in order and upload your audio file
2. **Copy the folder ID** from Colab output
3. **Copy the generated Apps Script code** to your Apps Script project
4. **Add the main transcriber code** (provided separately)
5. **Run transcription** in Apps Script

## 📞 Support

If you encounter issues:
- Check that your API key is correctly set in Script Properties
- Verify Drive API is enabled
- Ensure your audio file uploaded successfully to Google Drive
- Monitor the Apps Script execution logs for detailed progress

## 🎉 What You'll Get

- **Enhanced transcript** with metadata and formatting
- **Processing analytics** showing success rates and timing
- **Automatic Google Drive storage** of all results
- **Detailed logs** for troubleshooting

The system handles everything automatically once set up!