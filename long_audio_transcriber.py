import os
import time
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import google.generativeai as genai
from pydub import AudioSegment
from pathlib import Path
import tempfile

# Load environment variables
load_dotenv()

class ChunkedAudioTranscriber:
    def __init__(self, chunk_duration_minutes=25):
        """
        Initialize the transcriber with chunking capability
        
        Args:
            chunk_duration_minutes (int): Duration of each chunk in minutes (default: 25 minutes)
        """
        self.chunk_duration_minutes = chunk_duration_minutes
        self.chunk_duration_ms = chunk_duration_minutes * 60 * 1000  # Convert to milliseconds
        
        # Configure Gemini
        google_key = os.getenv('GOOGLE_API_KEY')
        if not google_key:
            raise ValueError('GOOGLE_API_KEY not found in .env file')
        
        genai.configure(api_key=google_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash-exp")
    
    def split_audio(self, audio_file_path: str) -> list:
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
    
    def transcribe_chunk(self, chunk_info: tuple, chunk_index: int, total_chunks: int) -> dict:
        """Transcribe a single audio chunk"""
        chunk_path, start_ms, end_ms = chunk_info
        
        start_time_str = str(timedelta(milliseconds=start_ms)).split('.')[0]
        end_time_str = str(timedelta(milliseconds=end_ms)).split('.')[0]
        
        print(f"\n🎵 Transcribing chunk {chunk_index + 1}/{total_chunks}")
        print(f"⏰ Time range: {start_time_str} - {end_time_str}")
        
        try:
            chunk_start_time = time.time()
            
            # Upload the chunk
            print("🔄 Uploading chunk to Gemini...")
            audio_file = genai.upload_file(path=chunk_path)
            
            # Wait for processing
            while audio_file.state.name == "PROCESSING":
                print("⏳ Processing chunk...")
                time.sleep(5)
                audio_file = genai.get_file(audio_file.name)
            
            if audio_file.state.name == "FAILED":
                return {
                    'success': False,
                    'error': f'Chunk {chunk_index + 1} processing failed',
                    'transcript': '',
                    'start_time': start_ms,
                    'end_time': end_ms
                }
            
            # Create enhanced prompt for chunk transcription
            prompt = f"""Please transcribe this audio chunk accurately. This is part {chunk_index + 1} of {total_chunks} from a religious/biblical teaching.

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

Please provide only the transcript text for this audio segment."""
            
            # Generate transcription
            response = self.model.generate_content([prompt, audio_file])
            
            # Clean up uploaded file
            genai.delete_file(audio_file.name)
            
            chunk_time = time.time() - chunk_start_time
            
            if response.text:
                transcript = response.text.strip()
                word_count = len(transcript.split())
                
                print(f"✅ Chunk {chunk_index + 1} completed in {chunk_time:.2f}s")
                print(f"📝 Words transcribed: {word_count}")
                
                return {
                    'success': True,
                    'error': None,
                    'transcript': transcript,
                    'start_time': start_ms,
                    'end_time': end_ms,
                    'processing_time': chunk_time,
                    'word_count': word_count
                }
            else:
                return {
                    'success': False,
                    'error': f'No transcription generated for chunk {chunk_index + 1}',
                    'transcript': '',
                    'start_time': start_ms,
                    'end_time': end_ms,
                    'processing_time': chunk_time
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f"Chunk {chunk_index + 1} error: {str(e)}",
                'transcript': '',
                'start_time': start_ms,
                'end_time': end_ms,
                'processing_time': 0
            }
    
    def merge_transcriptions(self, chunk_results: list) -> dict:
        """Merge chunk transcriptions into final result"""
        successful_chunks = [r for r in chunk_results if r['success']]
        failed_chunks = [r for r in chunk_results if not r['success']]
        
        if not successful_chunks:
            return {
                'success': False,
                'error': 'All chunks failed to transcribe',
                'transcript': '',
                'chunk_results': chunk_results
            }
        
        # Combine all successful transcripts
        full_transcript_parts = []
        total_words = 0
        total_processing_time = 0
        
        for result in successful_chunks:
            full_transcript_parts.append(result['transcript'])
            total_words += result.get('word_count', 0)
            total_processing_time += result.get('processing_time', 0)
        
        # Join with double newlines to separate chunks
        full_transcript = '\n\n'.join(full_transcript_parts)
        
        # Clean up any formatting issues
        full_transcript = full_transcript.replace('\n\n\n', '\n\n')  # Remove triple newlines
        
        return {
            'success': True,
            'error': None,
            'transcript': full_transcript,
            'total_chunks': len(chunk_results),
            'successful_chunks': len(successful_chunks),
            'failed_chunks': len(failed_chunks),
            'total_words': total_words,
            'total_processing_time': total_processing_time,
            'chunk_results': chunk_results
        }
    
    def transcribe_long_audio(self, audio_file_path: str) -> dict:
        """Main method to transcribe long audio files with chunking"""
        print("🎙️  ENHANCED GEMINI TRANSCRIPTION WITH CHUNKING")
        print("=" * 60)
        
        overall_start_time = time.time()
        
        # Check if file exists
        if not os.path.exists(audio_file_path):
            return {
                'success': False,
                'error': f'Audio file not found: {audio_file_path}',
                'transcript': ''
            }
        
        # Get file info
        file_size_mb = os.path.getsize(audio_file_path) / 1024 / 1024
        print(f"📁 File size: {file_size_mb:.2f} MB")
        
        try:
            # Split audio into chunks
            chunks = self.split_audio(audio_file_path)
            
            # Transcribe each chunk
            chunk_results = []
            
            for i, chunk_info in enumerate(chunks):
                chunk_result = self.transcribe_chunk(chunk_info, i, len(chunks))
                chunk_results.append(chunk_result)
                
                # Small delay between chunks to avoid rate limiting
                if i < len(chunks) - 1:  # Don't delay after the last chunk
                    print("⏳ Waiting 2 seconds before next chunk...")
                    time.sleep(2)
            
            # Clean up temporary chunk files
            for chunk_path, _, _ in chunks:
                if chunk_path != audio_file_path:  # Don't delete original file
                    try:
                        os.remove(chunk_path)
                        # Also remove the temp directory if it's empty
                        temp_dir = os.path.dirname(chunk_path)
                        if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                            os.rmdir(temp_dir)
                    except:
                        pass  # Ignore cleanup errors
            
            # Merge results
            final_result = self.merge_transcriptions(chunk_results)
            final_result['total_processing_time'] = time.time() - overall_start_time
            
            return final_result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Overall transcription error: {str(e)}",
                'transcript': '',
                'total_processing_time': time.time() - overall_start_time
            }

def save_transcript_with_metadata(result: dict, audio_file_path: str, output_file: str = None):
    """Save transcript with detailed metadata"""
    try:
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            audio_name = Path(audio_file_path).stem
            output_file = f"{audio_name}_transcript_{timestamp}.txt"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            # Header with metadata
            f.write("=" * 80 + "\n")
            f.write("ENHANCED GEMINI TRANSCRIPTION WITH CHUNKING\n")
            f.write("=" * 80 + "\n")
            f.write(f"Audio File: {os.path.basename(audio_file_path)}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total Processing Time: {result.get('total_processing_time', 0):.2f} seconds\n")
            f.write(f"Total Chunks: {result.get('total_chunks', 'N/A')}\n")
            f.write(f"Successful Chunks: {result.get('successful_chunks', 'N/A')}\n")
            f.write(f"Failed Chunks: {result.get('failed_chunks', 'N/A')}\n")
            f.write(f"Total Words: {result.get('total_words', 'N/A'):,}\n")
            f.write("=" * 80 + "\n\n")
            
            # Main transcript
            f.write(result['transcript'])
            
            # Detailed chunk information
            if 'chunk_results' in result:
                f.write("\n\n" + "=" * 80 + "\n")
                f.write("CHUNK PROCESSING DETAILS\n")
                f.write("=" * 80 + "\n")
                
                for i, chunk_result in enumerate(result['chunk_results']):
                    start_time = str(timedelta(milliseconds=chunk_result['start_time'])).split('.')[0]
                    end_time = str(timedelta(milliseconds=chunk_result['end_time'])).split('.')[0]
                    
                    f.write(f"\nChunk {i + 1}:\n")
                    f.write(f"  Time Range: {start_time} - {end_time}\n")
                    f.write(f"  Status: {'SUCCESS' if chunk_result['success'] else 'FAILED'}\n")
                    f.write(f"  Processing Time: {chunk_result.get('processing_time', 0):.2f}s\n")
                    f.write(f"  Word Count: {chunk_result.get('word_count', 0)}\n")
                    
                    if not chunk_result['success']:
                        f.write(f"  Error: {chunk_result['error']}\n")
        
        print(f"💾 Enhanced transcript saved to {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Error saving transcript: {str(e)}")
        return None

def save_json_results(result: dict, audio_file_path: str, output_file: str = None):
    """Save full results as JSON for debugging and analysis"""
    try:
        if output_file is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            audio_name = Path(audio_file_path).stem
            output_file = f"{audio_name}_results_{timestamp}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"📄 Detailed results saved to {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Error saving JSON results: {str(e)}")
        return None

def main():
    """Main function to transcribe long audio files with chunking"""
    
    # Configuration
    audio_file = r"C:\Users\presl\Downloads\Romans Overview English Only-20250709T194733Z-1-001\Romans Overview English Only\11 Romans 8v1 to 27 English only.mp3"
    chunk_duration = 25  # minutes per chunk
    
    # Check if audio file exists
    if not os.path.exists(audio_file):
        print(f"❌ Audio file not found: {audio_file}")
        print("Please make sure the file exists.")
        return
    
    # Initialize transcriber
    try:
        transcriber = ChunkedAudioTranscriber(chunk_duration_minutes=chunk_duration)
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        return
    
    # Run transcription
    result = transcriber.transcribe_long_audio(audio_file)
    
    if result['success']:
        print("\n✅ TRANSCRIPTION COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print(f"⏱️  Total processing time: {result['total_processing_time']:.2f} seconds")
        print(f"📦 Total chunks processed: {result['total_chunks']}")
        print(f"✅ Successful chunks: {result['successful_chunks']}")
        
        if result['failed_chunks'] > 0:
            print(f"❌ Failed chunks: {result['failed_chunks']}")
        
        print(f"📝 Total words: {result['total_words']:,}")
        
        # Show preview
        print(f"\n📜 TRANSCRIPT PREVIEW:")
        print("-" * 40)
        preview = result['transcript'][:500]
        print(preview + ("..." if len(result['transcript']) > 500 else ""))
        
        # Save files
        txt_file = save_transcript_with_metadata(result, audio_file)
        json_file = save_json_results(result, audio_file)
        
        if txt_file:
            print(f"\n🎉 Full transcript saved to '{txt_file}'")
            print(f"📂 File location: {os.path.abspath(txt_file)}")
        
        if json_file:
            print(f"📄 Detailed results saved to '{json_file}'")
        
    else:
        print(f"\n❌ TRANSCRIPTION FAILED!")
        print(f"Error: {result['error']}")
        
        # Still save whatever results we have
        if 'chunk_results' in result:
            json_file = save_json_results(result, audio_file)
            if json_file:
                print(f"📄 Partial results saved to '{json_file}'")

if __name__ == "__main__":
    main()
