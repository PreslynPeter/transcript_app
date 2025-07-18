import os
import time
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from pydub import AudioSegment
from pathlib import Path

# Load environment variables
load_dotenv()

def test_api_connection():
    """Test if API key and connection work"""
    print("🔍 Testing API connection...")
    
    google_key = os.getenv('GOOGLE_API_KEY')
    if not google_key:
        print("❌ GOOGLE_API_KEY not found in .env file")
        return False
    
    try:
        genai.configure(api_key=google_key)
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        
        # Simple test
        response = model.generate_content("Say 'API connection successful'")
        if response.text:
            print("✅ API connection successful!")
            return True
        else:
            print("❌ API responded but no text returned")
            return False
            
    except Exception as e:
        print(f"❌ API connection failed: {str(e)}")
        return False

def test_audio_file(audio_path):
    """Test if audio file can be loaded and get basic info"""
    print(f"🔍 Testing audio file: {audio_path}")
    
    if not os.path.exists(audio_path):
        print(f"❌ File not found: {audio_path}")
        return False
    
    try:
        # Test with pydub
        audio = AudioSegment.from_file(audio_path)
        duration_seconds = len(audio) / 1000
        duration_minutes = duration_seconds / 60
        
        print(f"✅ Audio file loaded successfully!")
        print(f"📊 Duration: {duration_minutes:.2f} minutes ({duration_seconds:.1f} seconds)")
        print(f"📊 Sample rate: {audio.frame_rate} Hz")
        print(f"📊 Channels: {audio.channels}")
        print(f"📊 File size: {os.path.getsize(audio_path) / 1024 / 1024:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"❌ Audio file error: {str(e)}")
        return False

def test_small_transcription(audio_path):
    """Test transcription with just the first 30 seconds"""
    print("🔍 Testing small transcription (first 30 seconds)...")
    
    try:
        # Load audio and take first 30 seconds
        audio = AudioSegment.from_file(audio_path)
        small_chunk = audio[:30000]  # 30 seconds in milliseconds
        
        # Save small chunk
        temp_file = "temp_test_chunk.mp3"
        small_chunk.export(temp_file, format="mp3")
        
        # Test upload and transcription
        google_key = os.getenv('GOOGLE_API_KEY')
        genai.configure(api_key=google_key)
        
        print("🔄 Uploading 30-second test chunk...")
        audio_file = genai.upload_file(path=temp_file)
        
        # Wait for processing
        while audio_file.state.name == "PROCESSING":
            print("⏳ Processing...")
            time.sleep(2)
            audio_file = genai.get_file(audio_file.name)
        
        if audio_file.state.name == "FAILED":
            print("❌ Test chunk processing failed")
            return False
        
        print("🔄 Generating test transcription...")
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        
        prompt = """Please transcribe this short audio test clip. Just provide the transcript text."""
        
        response = model.generate_content([prompt, audio_file])
        
        # Cleanup
        genai.delete_file(audio_file.name)
        os.remove(temp_file)
        
        if response.text:
            transcript = response.text.strip()
            print(f"✅ Test transcription successful!")
            print(f"📝 Sample text: {transcript[:100]}...")
            return True
        else:
            print("❌ No transcription text returned")
            return False
            
    except Exception as e:
        print(f"❌ Test transcription failed: {str(e)}")
        # Cleanup
        try:
            if 'audio_file' in locals():
                genai.delete_file(audio_file.name)
            if os.path.exists("temp_test_chunk.mp3"):
                os.remove("temp_test_chunk.mp3")
        except:
            pass
        return False

def main():
    """Main debugging function"""
    print("🔧 AUDIO TRANSCRIPTION DEBUGGER")
    print("=" * 50)
    
    # Your audio file path - UPDATE THIS
    audio_file = r"C:\Users\samjo\projects\transcription\data\06 Romans 3 English only.mp3"
    
    print(f"🎵 Testing file: {os.path.basename(audio_file)}")
    print()
    
    # Test 1: API Connection
    if not test_api_connection():
        print("\n❌ STOP: Fix API connection first!")
        print("Check your .env file and API key")
        return
    
    print()
    
    # Test 2: Audio File
    if not test_audio_file(audio_file):
        print("\n❌ STOP: Fix audio file issues first!")
        print("Check file path and format")
        return
    
    print()
    
    # Test 3: Small Transcription
    if not test_small_transcription(audio_file):
        print("\n❌ STOP: Basic transcription failed!")
        print("Check API limits and model availability")
        return
    
    print("\n" + "=" * 50)
    print("✅ ALL TESTS PASSED!")
    print("🎉 Your setup should work with the main script")
    print("Try running long_audio_transcriber.py again")
    print()
    print("If it still fails, check:")
    print("- API rate limits (try smaller chunks)")
    print("- Internet connection stability")
    print("- Audio file encoding issues")

if __name__ == "__main__":
    main()