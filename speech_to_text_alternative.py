import os
import time
from datetime import datetime
from dotenv import load_dotenv
from google.cloud import speech
from pydub import AudioSegment
from pathlib import Path
import io

# Load environment variables
load_dotenv()

class SpeechToTextTranscriber:
    def __init__(self):
        """
        Initialize the Speech-to-Text transcriber
        Note: Requires GOOGLE_APPLICATION_CREDENTIALS environment variable
        pointing to a service account key file
        """
        self.client = speech.SpeechClient()
    
    def convert_to_wav(self, audio_file_path: str) -> str:
        """Convert audio file to WAV format if needed"""
        audio_path = Path(audio_file_path)
        
        if audio_path.suffix.lower() == '.wav':
            return audio_file_path
        
        print(f"🔄 Converting {audio_path.suffix} to WAV format...")
        
        # Load and convert to WAV
        audio = AudioSegment.from_file(audio_file_path)
        
        # Convert to mono 16kHz (optimal for Speech-to-Text)
        audio = audio.set_channels(1).set_frame_rate(16000)
        
        # Create output filename
        wav_path = audio_path.with_suffix('.wav')
        audio.export(wav_path, format="wav")
        
        print(f"✅ Converted to: {wav_path}")
        return str(wav_path)
    
    def transcribe_long_audio(self, audio_file_path: str, language_code: str = "en-US") -> dict:
        """
        Transcribe long audio file using Google Speech-to-Text API
        
        Args:
            audio_file_path (str): Path to audio file
            language_code (str): Language code (e.g., "en-US", "es-ES")
        """
        print("🎙️  GOOGLE SPEECH-TO-TEXT TRANSCRIPTION")
        print("=" * 50)
        
        start_time = time.time()
        
        try:
            # Convert to WAV if needed
            wav_path = self.convert_to_wav(audio_file_path)
            
            # Get file size
            file_size_mb = os.path.getsize(wav_path) / 1024 / 1024
            print(f"📁 WAV file size: {file_size_mb:.2f} MB")
            
            # Read audio file
            with io.open(wav_path, "rb") as audio_file:
                content = audio_file.read()
            
            # Configure audio and recognition settings
            audio = speech.RecognitionAudio(content=content)
            
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,
                language_code=language_code,
                enable_automatic_punctuation=True,
                enable_speaker_diarization=True,
                diarization_speaker_count=2,  # Adjust based on expected speakers
                model="latest_long",  # Optimized for long audio
                use_enhanced=True,  # Better accuracy
            )
            
            print("🔄 Sending request to Google Speech-to-Text...")
            print("⏳ This may take several minutes for long audio files...")
            
            # Use long-running operation for files > 1 minute
            operation = self.client.long_running_recognize(
                config=config, 
                audio=audio
            )
            
            print("⏳ Waiting for transcription to complete...")
            response = operation.result(timeout=1800)  # 30 minute timeout
            
            # Process results
            transcript_parts = []
            confidence_scores = []
            
            for result in response.results:
                alternative = result.alternatives[0]
                transcript_parts.append(alternative.transcript)
                confidence_scores.append(alternative.confidence)
            
            full_transcript = " ".join(transcript_parts)
            avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
            
            # Speaker diarization results
            speaker_segments = []
            if hasattr(response, 'speaker_diarization') and response.speaker_diarization:
                for segment in response.speaker_diarization.segments:
                    speaker_segments.append({
                        'speaker_tag': segment.speaker_tag,
                        'start_time': segment.start_time.total_seconds(),
                        'end_time': segment.end_time.total_seconds()
                    })
            
            processing_time = time.time() - start_time
            word_count = len(full_transcript.split())
            
            # Clean up converted WAV file if it's different from original
            if wav_path != audio_file_path:
                try:
                    os.remove(wav_path)
                    print("🧹 Cleaned up temporary WAV file")
                except:
                    pass
            
            return {
                'success': True,
                'error': None,
                'transcript': full_transcript,
                'confidence': avg_confidence,
                'word_count': word_count,
                'processing_time': processing_time,
                'speaker_segments': speaker_segments,
                'language_code': language_code
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Speech-to-Text error: {str(e)}",
                'transcript': '',
                'processing_time': time.time() - start_time if 'start_time' in locals() else 0
            }

def save_speech_to_text_transcript(result: dict, audio_file_path: str, output_file: str = None):
    """Save Speech-to-Text transcript with metadata"""
    try:
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            audio_name = Path(audio_file_path).stem
            output_file = f"{audio_name}_speech_to_text_{timestamp}.txt"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            # Header
            f.write("=" * 70 + "\n")
            f.write("GOOGLE SPEECH-TO-TEXT TRANSCRIPTION\n")
            f.write("=" * 70 + "\n")
            f.write(f"Audio File: {os.path.basename(audio_file_path)}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Processing Time: {result.get('processing_time', 0):.2f} seconds\n")
            f.write(f"Language: {result.get('language_code', 'N/A')}\n")
            f.write(f"Average Confidence: {result.get('confidence', 0):.3f}\n")
            f.write(f"Word Count: {result.get('word_count', 0):,}\n")
            f.write("=" * 70 + "\n\n")
            
            # Main transcript
            f.write("TRANSCRIPT:\n")
            f.write("-" * 20 + "\n")
            f.write(result['transcript'])
            
            # Speaker information if available
            if result.get('speaker_segments'):
                f.write("\n\n" + "=" * 70 + "\n")
                f.write("SPEAKER DIARIZATION\n")
                f.write("=" * 70 + "\n")
                f.write("Note: Speaker diarization identifies different speakers but doesn't\n")
                f.write("map them to specific segments of the transcript automatically.\n\n")
                
                for segment in result['speaker_segments']:
                    start_min = int(segment['start_time'] // 60)
                    start_sec = int(segment['start_time'] % 60)
                    end_min = int(segment['end_time'] // 60)
                    end_sec = int(segment['end_time'] % 60)
                    
                    f.write(f"Speaker {segment['speaker_tag']}: "
                           f"{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}\n")
        
        print(f"💾 Speech-to-Text transcript saved to {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Error saving transcript: {str(e)}")
        return None

def setup_instructions():
    """Print setup instructions for Google Speech-to-Text"""
    print("\n" + "=" * 70)
    print("GOOGLE SPEECH-TO-TEXT SETUP INSTRUCTIONS")
    print("=" * 70)
    print("\n1. Create a Google Cloud Project:")
    print("   - Go to https://console.cloud.google.com/")
    print("   - Create a new project or select existing one")
    print("\n2. Enable the Speech-to-Text API:")
    print("   - Go to APIs & Services > Library")
    print("   - Search for 'Speech-to-Text API' and enable it")
    print("\n3. Create a Service Account:")
    print("   - Go to IAM & Admin > Service Accounts")
    print("   - Create a new service account")
    print("   - Download the JSON key file")
    print("\n4. Set Environment Variable:")
    print("   - Set GOOGLE_APPLICATION_CREDENTIALS to the path of your JSON key file")
    print("   - Example: export GOOGLE_APPLICATION_CREDENTIALS='/path/to/key.json'")
    print("\n5. Install dependencies:")
    print("   - pip install google-cloud-speech pydub")
    print("\n" + "=" * 70)

def main():
    """Main function for Speech-to-Text transcription"""
    
    # Check if credentials are set
    if not os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        print("❌ GOOGLE_APPLICATION_CREDENTIALS not found!")
        setup_instructions()
        return
    
    # Configuration
    audio_file = r"C:\Users\samjo\projects\transcription\data\04 Romans 2v1 to 16 English only (1).mp3"
    language_code = "en-US"  # Change as needed
    
    # Check if file exists
    if not os.path.exists(audio_file):
        print(f"❌ Audio file not found: {audio_file}")
        return
    
    # Initialize transcriber
    try:
        transcriber = SpeechToTextTranscriber()
    except Exception as e:
        print(f"❌ Failed to initialize Speech-to-Text client: {e}")
        setup_instructions()
        return
    
    # Run transcription
    result = transcriber.transcribe_long_audio(audio_file, language_code)
    
    if result['success']:
        print("\n✅ TRANSCRIPTION COMPLETED!")
        print("=" * 50)
        print(f"⏱️  Processing time: {result['processing_time']:.2f} seconds")
        print(f"🎯 Average confidence: {result['confidence']:.3f}")
        print(f"📝 Word count: {result['word_count']:,}")
        print(f"👥 Speaker segments: {len(result.get('speaker_segments', []))}")
        
        # Show preview
        print(f"\n📜 TRANSCRIPT PREVIEW:")
        print("-" * 30)
        preview = result['transcript'][:500]
        print(preview + ("..." if len(result['transcript']) > 500 else ""))
        
        # Save transcript
        output_file = save_speech_to_text_transcript(result, audio_file)
        
        if output_file:
            print(f"\n🎉 Transcript saved to '{output_file}'")
            print(f"📂 File location: {os.path.abspath(output_file)}")
        
    else:
        print(f"\n❌ TRANSCRIPTION FAILED!")
        print(f"Error: {result['error']}")

if __name__ == "__main__":
    main()