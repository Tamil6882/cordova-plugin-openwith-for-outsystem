# cordova-plugin-openwith

> This plugin for [Apache Cordova](https://cordova.apache.org/) registers your app to handle certain types of files and enables the **Send to...** functionality on both iOS and Android platforms.

## Overview

This is an enhanced version of [cordova-plugin-openwith](https://github.com/j3k0/cordova-plugin-openwith) optimized for both standard Cordova applications and **OutSystem** mobile development.

### What's Different in This Version

- **Multi-type Content Sharing**: Supports URLs, text, and images. Easily customizable via configuration files
- **Bulk Image Sharing**: Share multiple photos at once (default: 10, configurable)
- **Streamlined UX**: Opens app directly without native "Post" UI for better user experience
- **iOS Share Extension**: Full integration with iOS Share Extension framework
- **Android Intent Handling**: Comprehensive SEND and SEND_MULTIPLE intent support
- **OutSystem Ready**: Pre-configured for OutSystem mobile application integration
- **Base64 Data Support**: Efficient handling of shared content via base64 encoding

---

## Table of Contents

- [Installation](#installation)
- [Installation for OutSystem](#installation-for-outsystem)
- [Configuration](#configuration)
- [Usage](#usage)
- [Usage in OutSystem](#usage-in-outsystem)
- [API Reference](#api-reference)
- [Platform-Specific Details](#platform-specific-details)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

### Standard Cordova Installation

Install the plugin with required variables:

```bash
cordova plugin add cordova-plugin-openwith-for-outsystem \
  --variable IOS_URL_SCHEME=myuniqueappscheme
```

### Installation Variables

| Variable | Example | Required | Notes |
|---|---|---|---|
| `IOS_URL_SCHEME` | `myuniqueappscheme` | ✅ Yes | Unique lowercase alphanumeric scheme for iOS deep linking |
| `DISPLAY_NAME` | `My Custom App` | ❌ No | Custom app name for share extension (defaults to project name) |
| `IOS_BUNDLE_IDENTIFIER` | `com.domain.app` | ❌ No | iOS bundle identifier (auto-detected if not specified) |

### Verification

After installation, verify the plugin is loaded:

```javascript
document.addEventListener('deviceready', function() {
  console.log('OpenWith plugin available:', !!cordova.openwith);
}, false);
```

---

## Installation for OutSystem

### Prerequisites

- OutSystem Studio with Cordova plugin support enabled
- iOS deployment: Xcode command-line tools configured
- Android deployment: Android SDK properly configured
- Valid provisioning profiles (iOS)

### OutSystem Installation Steps

#### 1. Add Plugin via OutSystem Studio

```
1. Open your OutSystem Mobile App in Studio
2. Navigate to Manage Dependencies
3. Add Plugin Reference:
   - Plugin Name: cordova-plugin-openwith-for-outsystem
   - Source: GitHub
   - Repository: https://github.com/Tamil6882/cordova-plugin-openwith-for-outsystem.git
```

#### 2. Configure Plugin Parameters

In your OutSystem app settings, configure:

```javascript
// In App OnApplicationStart
OutSystemPlugins.SetPluginParams("cordova-plugin-openwith", {
  IOS_URL_SCHEME: "outsystemuniquescheme",
  DISPLAY_NAME: "My OutSystem App"
});
```

#### 3. Initialize in Client Action

```javascript
// Client Action: InitializeOpenWith
cordova.openwith.init(
  function() {
    OutSystem.ShowMessage("OpenWith initialized");
  },
  function(error) {
    OutSystem.ShowError("OpenWith init failed: " + error);
  }
);
```

#### 4. Handle Share Events

Create a Client Action to handle incoming shared content:

```javascript
// Client Action: HandleSharedContent
function setupOpenWithHandler() {
  cordova.openwith.addHandler(function(intent) {
    // Pass data to OutSystem backend
    SendSharedContentToServer({
      text: intent.text,
      items: JSON.stringify(intent.items)
    });
  });
}
```

---

## Configuration

### iOS Configuration

#### Required: Share Extension Setup

The plugin automatically creates a Share Extension target. No manual configuration needed, but verify:

1. In Xcode, check for `ShareExtension` target
2. Verify app groups entitlement is enabled
3. Confirm URL scheme matches `IOS_URL_SCHEME` variable

#### Optional: Customize Supported UTI Types

Edit `ShareExtension-Info.plist` to modify supported file types:

```xml
<!-- Supports URLs, Images, and Text -->
<key>NSExtensionActivationRule</key>
<string>SUBQUERY(
  extensionItems,
  $extensionItem,
  SUBQUERY(
    $extensionItem.attachments,
    $attachment,
    (
      ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.url" ||
      ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.image" ||
      ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "public.text"
    )
  ).@count == $extensionItem.attachments.@count
).@count == extensionItems.@count</string>
```

#### Maximum Images Configuration

To change the maximum number of shareable images (default: 10), edit the plist:

```xml
<key>MaximumSharedImages</key>
<integer>20</integer>
```

### Android Configuration

Android configuration is handled via `plugin.xml`. The plugin registers for:

- **MIME Types**: `audio/*`, `application/*`, `video/*`, `image/*`, `text/*`
- **Actions**: `android.intent.action.SEND`, `android.intent.action.SEND_MULTIPLE`
- **Categories**: `DEFAULT`, `BROWSABLE`

To customize, edit `plugin.xml` before installation:

```xml
<data android:mimeType="image/*" />
<data android:mimeType="video/*" />
<data android:mimeType="application/pdf" />
```

---

## Usage

### Basic Setup

```javascript
document.addEventListener('deviceready', setupOpenWith, false);

function setupOpenWith() {
  // Set verbosity level (optional)
  cordova.openwith.setVerbosity(cordova.openwith.DEBUG);

  // Initialize the plugin
  cordova.openwith.init(initSuccess, initError);

  function initSuccess() {
    console.log('✓ OpenWith initialized');
    setupHandlers();
  }

  function initError(err) {
    console.error('✗ OpenWith init failed:', err);
  }
}
```

### Handling Shared Content

```javascript
function setupHandlers() {
  cordova.openwith.addHandler(handleSharedIntent);
}

function handleSharedIntent(intent) {
  console.log('→ Shared intent received');
  console.log('  Description:', intent.text);

  // Process each shared item
  intent.items.forEach((item, index) => {
    console.log(`Item ${index}:`);
    console.log('  UTI:', item.uti);           // e.g., public.url, public.image
    console.log('  MIME:', item.type);          // e.g., image/jpeg
    console.log('  Name:', item.name);          // e.g., photo.jpg
    console.log('  Data:', item.data);          // URL or base64 string
    console.log('  File URL:', item.fileUrl);   // For file-based sharing
  });

  // Process based on content type
  processSharedContent(intent);
}
```

### Processing Different Content Types

```javascript
function processSharedContent(intent) {
  intent.items.forEach((item) => {
    switch (item.uti) {
      case 'public.url':
        handleSharedUrl(item.data);
        break;
      case 'public.text':
        handleSharedText(item.data);
        break;
      case 'public.image':
        handleSharedImage(item);
        break;
      default:
        console.log('Unknown UTI:', item.uti);
    }
  });
}

function handleSharedUrl(url) {
  console.log('Processing URL:', url);
  // Handle URL sharing - e.g., store, display, process
}

function handleSharedText(text) {
  console.log('Processing text:', text);
  // Handle text sharing
}

function handleSharedImage(item) {
  console.log('Processing image:', item.name);
  // Method 1: Use base64 directly
  if (item.base64) {
    displayImage(item.base64);
  }
  // Method 2: Load from file URL
  else if (item.fileUrl) {
    loadImageFromFile(item.fileUrl);
  }
}
```

### Loading File Content

```javascript
function loadImageFromFile(fileUrl, successCallback, errorCallback) {
  const dataDescriptor = {
    fileUrl: fileUrl,
    type: 'image/jpeg'
  };

  cordova.openwith.load(dataDescriptor,
    function(base64, descriptor) {
      console.log('✓ Image loaded:', descriptor.name);
      successCallback(base64);
    },
    function(err) {
      console.error('✗ Failed to load image:', err);
      errorCallback(err);
    }
  );
}
```

---

## Usage in OutSystem

### 1. Initialize OpenWith on App Startup

**Create Client Action**: `InitOpenWith`

```javascript
function initOpenWith() {
  if (!cordova.openwith) {
    OutSystem.ShowError("OpenWith plugin not available");
    return;
  }

  cordova.openwith.setVerbosity(cordova.openwith.INFO);

  cordova.openwith.init(
    function() {
      console.log("✓ OpenWith ready");
      setupOpenWithHandler();
      Entities.AppConfig.LastInitResult = "success";
    },
    function(error) {
      console.error("✗ OpenWith init failed:", error);
      Entities.AppConfig.LastInitResult = "error: " + error;
    }
  );
}

// Call on App Start
document.addEventListener('deviceready', initOpenWith, false);
```

### 2. Setup Handler for Shared Content

**Create Client Action**: `SetupOpenWithHandler`

```javascript
function setupOpenWithHandler() {
  cordova.openwith.addHandler(function(intent) {
    // Store shared data temporarily
    window.LastSharedIntent = intent;

    // Trigger OutSystem event/screen transition
    OutSystem.Navigation.Navigate(Screens.SharedContentScreen, {
      SharedData: JSON.stringify(intent)
    });
  });
}
```

### 3. Process Shared Content in OutSystem

**Create Server Action**: `ProcessSharedContent`

```
Input: SharedContent (Text - JSON)
Output: ContentResult (Record)

// JavaScript Logic
var content = JSON.parse(SharedContent);

// Process items
for (var i = 0; i < content.items.length; i++) {
  var item = content.items[i];
  
  if (item.uti === 'public.url') {
    // Store URL
    CreateUrlEntity(item.data);
  }
  else if (item.uti === 'public.image') {
    // Process image
    ProcessImageShare(item.base64, item.name);
  }
}
```

### 4. Example: Image Sharing Integration

```javascript
// Client Action: HandleImageShare
function handleImageShare(base64Data, imageName) {
  // Convert base64 to blob
  var blob = base64ToBlob(base64Data, 'image/jpeg');

  // Upload to server
  var xhr = new XMLHttpRequest();
  var formData = new FormData();
  formData.append('image', blob, imageName);

  xhr.open('POST', '/api/upload', true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      OutSystem.ShowMessage("✓ Image uploaded: " + imageName);
      // Trigger OutSystem action on upload success
      ImageUploadSuccess(imageName);
    }
  };
  xhr.send(formData);
}

function base64ToBlob(base64, mimeType) {
  var byteCharacters = atob(base64);
  var byteNumbers = [];
  for (var i = 0; i < byteCharacters.length; i++) {
    byteNumbers.push(byteCharacters.charCodeAt(i));
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}
```

### 5. OutSystem Entity Structure

Define entity to track shared content:

```
SharedContent
├── Id (Primary Key)
├── ContentType (Text) - url, text, image
├── ContentValue (Text) - URL or text value
├── ImageFileName (Text)
├── ImageBase64 (Text - Long)
├── Description (Text)
├── CreatedOn (DateTime)
└── ProcessedOn (DateTime)
```

---

## API Reference

### Methods

#### `cordova.openwith.init(successCallback, errorCallback)`

Initialize the OpenWith plugin. Must be called once after `deviceready`.

**Parameters:**
- `successCallback` (Function): Called on successful initialization
- `errorCallback` (Function): Called on initialization failure

**Example:**
```javascript
cordova.openwith.init(
  () => console.log('Ready'),
  (err) => console.error('Failed:', err)
);
```

---

#### `cordova.openwith.addHandler(handlerFunction)`

Register a callback to handle incoming shared content.

**Parameters:**
- `handlerFunction` (Function): Handler function receiving intent object

**Handler Function Signature:**
```javascript
function(intent) {
  // intent.text: String - descriptive text
  // intent.items: Array - array of data descriptors
}
```

**Example:**
```javascript
cordova.openwith.addHandler((intent) => {
  console.log('Items received:', intent.items.length);
});
```

---

#### `cordova.openwith.load(dataDescriptor, successCallback, errorCallback)`

Load shared file content (especially useful for images).

**Parameters:**
- `dataDescriptor` (Object): Descriptor from shared item
- `successCallback` (Function): Called with base64 content
- `errorCallback` (Function): Called on error

**Example:**
```javascript
cordova.openwith.load(
  item,
  (base64) => console.log('Loaded, size:', base64.length),
  (err) => console.error('Load failed:', err)
);
```

---

#### `cordova.openwith.setVerbosity(level)`

Set logging verbosity level.

**Parameters:**
- `level` (Integer): One of:
  - `cordova.openwith.DEBUG` (0) - Maximum verbosity
  - `cordova.openwith.INFO` (10) - Default, normal info
  - `cordova.openwith.WARN` (20) - Warnings only
  - `cordova.openwith.ERROR` (30) - Errors only

**Example:**
```javascript
cordova.openwith.setVerbosity(cordova.openwith.DEBUG);
```

---

#### `cordova.openwith.setLogger(loggerFunction)`

Override default console.log for plugin logging.

**Parameters:**
- `loggerFunction` (Function): Custom logger function

**Example:**
```javascript
cordova.openwith.setLogger((msg) => {
  // Custom logging
  sendToAnalytics(msg);
});
```

---

#### `cordova.openwith.getVerbosity()`

Retrieve current verbosity level.

**Returns:** Current verbosity level

---

#### `cordova.openwith.about()`

Get plugin information.

**Returns:** String with plugin name and copyright

---

### Data Structures

#### Intent Object

```javascript
{
  text: String,           // Descriptive text (usually empty)
  items: Array            // Array of DataDescriptor objects
}
```

#### DataDescriptor Object

```javascript
{
  uti: String,            // Universal Type Identifier
                          // Possible values: "public.url", "public.text", "public.image"
  type: String,           // MIME type (e.g., "image/jpeg")
  data: String,           // URL string or base64 image data
  text: String,           // Text description (usually empty)
  name: String,           // Suggested filename
  utis: Array,            // Additional UTI information
  fileUrl: String,        // File URL (iOS/Android)
  base64: String          // Base64 content (after load)
}
```

---

## Platform-Specific Details

### iOS Implementation

The iOS implementation uses:

- **Share Extension**: Native extension that intercepts Share menu actions
- **App Groups**: Enables data sharing between main app and extension
- **Custom URL Scheme**: Launches main app from share extension
- **UserDefaults**: Stores shared content for main app retrieval

**Flow:**
```
User selects "Share" 
  → Share Extension receives content
  → Stores in shared container
  → Opens app via custom URL scheme
  → App detects intent and calls handlers
```

**Supported UTIs:**
- `public.url` - Web links
- `public.text` - Plain text
- `public.image` - Images (jpeg, png, gif, etc.)

### Android Implementation

The Android implementation uses:

- **Intent Filters**: Registers for SEND and SEND_MULTIPLE actions
- **Content Providers**: Accesses shared files via content URIs
- **MIME Type Handling**: Supports multiple file types

**Flow:**
```
User selects "Share"
  → Android routes to registered receivers
  → App receives Intent with data
  → Cordova bridge invokes handler
```

**Supported MIME Types:**
- `image/*` - All image formats
- `audio/*` - All audio formats
- `video/*` - All video formats
- `text/*` - Plain text
- `application/*` - PDFs, documents, etc.

---

## Examples

### Example 1: Share URL to App

```javascript
function handleUrlShare(url) {
  // Save to database
  saveSharedUrl({
    url: url,
    sharedAt: new Date(),
    source: 'share_extension'
  });

  // Display notification
  OutSystem.ShowMessage("✓ URL received: " + url);

  // Navigate to URL detail screen
  OutSystem.Navigation.Navigate(Screens.UrlDetailScreen, {
    url: url
  });
}
```

### Example 2: Bulk Image Import

```javascript
function handleMultipleImages(items) {
  var imageCount = items.filter(i => i.uti === 'public.image').length;

  // Show progress
  OutSystem.ShowMessage("Importing " + imageCount + " images...");

  // Process each image
  items.forEach((item) => {
    if (item.uti === 'public.image') {
      cordova.openwith.load(
        item,
        (base64) => uploadImage(base64, item.name),
        (err) => console.error('Load error:', err)
      );
    }
  });
}
```

### Example 3: Complete Integration

```javascript
// Complete OutSystem integration setup
(function() {
  var OpenWithManager = {
    isInitialized: false,

    initialize: function() {
      if (this.isInitialized) return;

      cordova.openwith.init(
        this.onInitSuccess.bind(this),
        this.onInitError.bind(this)
      );

      this.isInitialized = true;
    },

    onInitSuccess: function() {
      console.log('✓ OpenWith initialized');
      this.setupHandler();
    },

    onInitError: function(error) {
      console.error('✗ OpenWith init failed:', error);
    },

    setupHandler: function() {
      cordova.openwith.addHandler(this.handleIntent.bind(this));
    },

    handleIntent: function(intent) {
      var processed = {
        urls: [],
        texts: [],
        images: []
      };

      intent.items.forEach((item) => {
        switch (item.uti) {
          case 'public.url':
            processed.urls.push(item.data);
            break;
          case 'public.text':
            processed.texts.push(item.data);
            break;
          case 'public.image':
            processed.images.push(item);
            break;
        }
      });

      // Send to OutSystem
      this.notifyOutSystem(processed);
    },

    notifyOutSystem: function(data) {
      // Trigger OutSystem server action
      ProcessSharedContent({
        ContentData: JSON.stringify(data),
        Timestamp: new Date().toISOString()
      });
    }
  };

  // Initialize on deviceready
  document.addEventListener('deviceready', function() {
    OpenWithManager.initialize();
  }, false);

  // Expose to window
  window.OpenWithManager = OpenWithManager;
})();
```

---

## Troubleshooting

### iOS Issues

#### Share Extension Not Showing

**Problem:** App doesn't appear in Share menu

**Solutions:**
1. Verify Info.plist configuration in Xcode
2. Check app groups entitlement is enabled
3. Ensure URL scheme matches `IOS_URL_SCHEME` variable
4. Rebuild and reinstall app
5. Restart device

#### Custom URL Scheme Not Working

**Problem:** App doesn't open from share extension

**Solutions:**
1. Verify URL scheme is unique and not conflicting with other apps
2. Check that custom URL scheme is in correct case (lowercase typically)
3. Test with `x-web-search://` to verify deep linking works

#### Images Not Loading

**Problem:** `item.base64` is null or empty

**Solutions:**
1. Use `cordova.openwith.load()` to load image content
2. Verify image file size doesn't exceed memory limits
3. Check that image MIME type is supported

### Android Issues

#### Intent Not Received

**Problem:** Shared content doesn't trigger handler

**Solutions:**
1. Verify intent filters in AndroidManifest.xml
2. Ensure `SEND` and `SEND_MULTIPLE` actions are registered
3. Check MIME types match sharing source
4. Verify app is default handler (if needed)

#### File Access Errors

**Problem:** Cannot access shared files

**Solutions:**
1. Verify file URI scheme compatibility (content://)
2. Implement proper Android 6+ permissions handling
3. Use `cordova.openwith.load()` with error callback

#### Multiple Instances

**Problem:** Handler called multiple times

**Solutions:**
1. Verify handler is only added once
2. Check for `addHandler` in multiple locations
3. Use `cordova.openwith.numHandlers()` to debug

### Common Issues

#### Plugin Not Available

```javascript
if (typeof cordova === 'undefined' || !cordova.openwith) {
  console.error('OpenWith plugin not loaded');
  return;
}
```

**Solutions:**
1. Verify plugin installation: `cordova plugin list`
2. Ensure `deviceready` event has fired
3. Check plugin.xml for correct platform entries

#### Initialization Errors

**Solution Pattern:**
```javascript
cordova.openwith.init(
  function() {
    console.log('✓ Success');
  },
  function(error) {
    console.error('✗ Error:', error);
    // Retry after delay
    setTimeout(() => cordova.openwith.init(...), 2000);
  }
);
```

#### OutSystem Integration Issues

**Problem:** OutSystem screens not triggered from shared content

**Solution:**
```javascript
// Ensure navigation happens on main thread
setTimeout(() => {
  OutSystem.Navigation.Navigate(Screen, params);
}, 100);
```

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Before Starting
- Create an issue to discuss significant changes
- Check existing issues for duplicates

### Code Standards
- Follow the existing coding style
- Run `npm test` to verify linting (if applicable)
- Add comments for complex logic
- Test on both iOS and Android

### Submission
- Submit pull requests with clear descriptions
- Reference related issues
- All contributions must be licensed under MIT

---

## License

MIT License - See [LICENSE](./LICENSE) file

**Copyright (c)** 2013-2015 Jean-Christophe Hoelt  
**Modifications (c)** Tamil6882

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

---

## Support & Resources

- **Original Plugin**: [github.com/j3k0/cordova-plugin-openwith](https://github.com/j3k0/cordova-plugin-openwith)
- **Apache Cordova**: [cordova.apache.org](https://cordova.apache.org)
- **OutSystem Docs**: [OutSystem Platform](https://www.outsystems.com)
- **iOS Share Extension**: [Apple Developer Docs](https://developer.apple.com/library/content/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- **Android Intent Filters**: [Android Docs](https://developer.android.com/guide/components/intents-filters)
