# Long Audio Transcription Solutions

This repository provides solutions for transcribing long audio files (2+ hours) that address the common issue where Gemini only processes the first ~30 minutes of audio.

## The Problem

Your original script was encountering a known limitation:
- **Gemini Models**: While they have large context windows (1M tokens), they have practical limitations for very long audio files
- **30-Minute Cutoff**: Many users report that Gemini stops processing or becomes unreliable after ~30 minutes of audio
- **Undocumented Limits**: These limitations aren't well documented in the official API docs

## Solutions Provided

### Solution 1: Enhanced Gemini with Chunking (Recommended)
**File: `long_audio_transcriber.py`**

This enhanced version of your original script:
- ✅ **Automatically chunks** your 2-hour audio into 25-minute segments
- ✅ **Processes each chunk** separately using Gemini 2.0 Flash
- ✅ **Merges results** seamlessly into a complete transcript
- ✅ **Handles failures** gracefully - if one chunk fails, others continue
- ✅ **Detailed logging** shows progress for each chunk
- ✅ **Metadata tracking** with processing times and word counts

**Key Features:**
- Configurable chunk duration (default: 25 minutes)
- Automatic temporary file cleanup
- Rich error reporting and recovery
- Preserves your original Gemini prompt style
- Generates detailed reports with chunk information

### Solution 2: Google Speech-to-Text API (Alternative)
**File: `speech_to_text_alternative.py`**

A completely different approach using Google's dedicated Speech-to-Text API:
- ✅ **Purpose-built** for long audio transcription
- ✅ **No duration limits** (handles 2+ hour files natively)
- ✅ **Speaker diarization** built-in
- ✅ **Higher accuracy** for pure transcription tasks
- ✅ **Confidence scores** for quality assessment

## Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **For Solution 1 (Enhanced Gemini):**
   - Set up your `.env` file with `GOOGLE_API_KEY`
   - No additional setup required

3. **For Solution 2 (Speech-to-Text):**
   - Create a Google Cloud Project
   - Enable Speech-to-Text API
   - Create a service account and download JSON key
   - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

## Usage

### Enhanced Gemini Transcription
```bash
python long_audio_transcriber.py
```

This will:
1. Automatically split your 2-hour audio into chunks
2. Process each chunk with Gemini
3. Merge results into a complete transcript
4. Save both text and JSON results

### Speech-to-Text Alternative
```bash
python speech_to_text_alternative.py
```

This will:
1. Convert audio to optimal format
2. Send to Google Speech-to-Text API
3. Process the entire file at once
4. Return transcript with speaker information

## Configuration

### Chunk Duration (Solution 1)
You can adjust the chunk size in `long_audio_transcriber.py`:
```python
chunk_duration = 25  # minutes per chunk
```

Recommended values:
- **25 minutes**: Most reliable for Gemini
- **20 minutes**: More conservative, slower but safer
- **30 minutes**: Faster but may hit limits

### Language Settings (Solution 2)
For Speech-to-Text, adjust the language code:
```python
language_code = "en-US"  # Change as needed
```

## Expected Results

### For Your 2-Hour Romans Audio:
- **Enhanced Gemini**: ~5 chunks of 25 minutes each
- **Processing Time**: 15-30 minutes total
- **Output Quality**: Maintains your original prompt style
- **Word Count**: Expect 15,000-25,000 words for 2 hours

### Output Files:
1. **Main Transcript**: `[filename]_transcript_[timestamp].txt`
2. **Detailed Results**: `[filename]_results_[timestamp].json`
3. **Rich Metadata**: Processing times, chunk details, error reports

## Troubleshooting

### Common Issues:

1. **"GOOGLE_API_KEY not found"**
   - Create a `.env` file in the same directory
   - Add: `GOOGLE_API_KEY="your-api-key-here"`

2. **Audio file not found**
   - Update the file path in the script's main() function
   - Use forward slashes or raw strings for Windows paths

3. **Chunk processing fails**
   - Check your API rate limits
   - Ensure stable internet connection
   - The script will continue with other chunks

4. **Memory issues with large files**
   - Reduce chunk duration to 20 minutes
   - Ensure sufficient disk space for temporary files

## Why This Approach Works

### The Chunking Strategy:
1. **Avoids the 30-minute limitation** by keeping chunks small
2. **Maintains context** with thoughtful chunk boundaries
3. **Provides redundancy** - one failed chunk doesn't kill the job
4. **Enables monitoring** - you can see progress in real-time

### The Speech-to-Text Alternative:
1. **Purpose-built** for long audio transcription
2. **Enterprise-grade reliability** for media processing
3. **Additional features** like speaker diarization
4. **No hidden limitations** on audio duration

## Performance Comparison

| Method | 2-Hour Audio | Accuracy | Features | Setup |
|--------|-------------|----------|----------|-------|
| **Original Gemini** | ❌ ~30 min only | High | Custom prompts | Easy |
| **Enhanced Gemini** | ✅ Full audio | High | Custom prompts + chunking | Easy |
| **Speech-to-Text** | ✅ Full audio | Very High | Speaker ID + confidence | Moderate |

## Recommendations

1. **Start with Enhanced Gemini** (`long_audio_transcriber.py`) - it's closest to your original approach
2. **If you need higher reliability**, try Speech-to-Text for comparison
3. **For production use**, consider Speech-to-Text for its enterprise features
4. **Keep chunk duration at 25 minutes** unless you experience issues

## Next Steps

1. Run the enhanced Gemini script first to get your full 2-hour transcript
2. Compare a small segment with Speech-to-Text to evaluate quality differences
3. Choose the approach that best fits your workflow and accuracy needs

The enhanced Gemini approach should solve your immediate problem while maintaining the style and prompting approach you've already developed!