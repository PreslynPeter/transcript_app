# 🔧 How to Enable Drive API in Google Apps Script

## Step-by-Step Instructions

### Method 1: Using the Services Menu (Recommended)

1. **Open your Google Apps Script project**
   - Go to [script.google.com](https://script.google.com)
   - Open your transcription project

2. **Find the Services section**
   - Look at the left sidebar
   - You'll see "Services" with a **+** (plus) icon next to it
   - Click the **+** icon

3. **Add Google Drive API**
   - A popup window will appear titled "Add a service"
   - Scroll down or search for **"Google Drive API"**
   - Click on **"Google Drive API"**
   - Click the **"Add"** button

4. **Verify it's added**
   - You should now see "Drive" listed under Services in the sidebar
   - The Drive API is now enabled for your project

### Method 2: Using the Legacy Editor (if needed)

If you're using the legacy Apps Script editor:

1. **Go to Resources menu**
   - Click **Resources** in the top menu
   - Select **Advanced Google Services**

2. **Enable Drive API**
   - Find "Drive API" in the list
   - Toggle it to **ON**
   - Click **OK**

3. **Enable in Google Cloud Console** (if prompted)
   - Click the link to Google Cloud Console
   - Find "Drive API" and enable it there
   - Return to Apps Script

## 🎯 Visual Guide

```
Apps Script Interface:
├── Files
├── Libraries  
├── Services  ← Click the + icon here
│   └── + Add a service
└── Triggers
```

After adding:
```
Services:
├── Drive  ← This should appear
└── + Add a service
```

## ✅ How to Verify It's Working

Run this test function in your Apps Script:

```javascript
function testDriveAPI() {
  try {
    // Try to access Drive
    const user = Session.getActiveUser().getEmail();
    console.log('✅ Drive API is working!');
    console.log('User:', user);
    
    // Test creating a simple file
    const testFile = DriveApp.createFile('test.txt', 'Hello World');
    console.log('✅ Can create files');
    
    // Clean up
    testFile.setTrashed(true);
    console.log('✅ Test complete - Drive API is properly enabled');
    
    return true;
  } catch (error) {
    console.error('❌ Drive API error:', error.message);
    return false;
  }
}
```

## 🚨 Troubleshooting

### "Services" section not visible?
- Make sure you're using the **new Apps Script editor**
- Try refreshing the page
- Check if you're logged into the correct Google account

### "Drive API" not in the list?
- Make sure you're searching correctly (try just "Drive")
- Refresh the page and try again
- Check your internet connection

### Still having issues?
1. **Clear browser cache** and try again
2. **Try incognito/private mode**
3. **Use a different browser**
4. Make sure you have **edit permissions** on the Apps Script project

## 🎉 What This Enables

Once Drive API is enabled, your script can:
- ✅ Read audio files from Google Drive
- ✅ Create transcript files
- ✅ Access folders and file metadata
- ✅ Upload and download files
- ✅ Manage file permissions

## Next Steps

After enabling Drive API:
1. Set your `GOOGLE_API_KEY` in Script Properties
2. Copy the transcription code
3. Run `testSetup()` to verify everything works
4. Start transcribing your audio files!

The Drive API is essential for the transcription system to access your audio chunks and save the final transcripts.