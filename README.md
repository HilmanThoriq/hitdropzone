<div align="center">

# 📦 HitDropZone

### *Lightning-Fast File Transit Platform*

[![Version](https://img.shields.io/badge/version-1.1.1-blue.svg)](https://github.com/HilmanThoriq/hitdropzone/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?logo=supabase)](https://supabase.com/)

**Share files instantly without registration. No friction, just files.** 🚀

[🌐 Live Demo](https://hitdropzone.web.app) • [📖 Documentation](#features) • [🐛 Report Bug](https://github.com/HilmanThoriq/hitdropzone/issues) • [💡 Request Feature](https://github.com/HilmanThoriq/hitdropzone/issues)

<img src="https://via.placeholder.com/800x400/4F46E5/FFFFFF?text=HitDropZone+Screenshot" alt="HitDropZone Interface" width="100%"/>

</div>

---

## ✨ Features

### 🔥 Core Capabilities
- **📤 Zero-Registration Upload** - Share files immediately, no account needed
- **🔐 PIN Protection** - Secure your folders with custom 4+ digit PINs
- **📱 QR Code Sharing** - Generate scannable QR codes for instant mobile access
- **🔗 Direct Share Links** - Copy shareable links with embedded access
- **📦 Smart Downloads** - Single files download directly, multiple files as ZIP
- **⏰ Auto-Expiry** - Files automatically deleted after 7 days
- **🔍 Smart Search** - Find folders by name or owner instantly
- **📊 Real-time Progress** - Visual feedback during upload and download

### 🛡️ Security & Privacy
- ✅ PIN-based folder access control
- ✅ Secure filename sanitization
- ✅ No permanent data storage
- ✅ Privacy warnings for sensitive files
- ✅ Client-side file validation

### 🎨 User Experience
- 🎯 Clean, intuitive interface
- 📱 Fully responsive (mobile & desktop)
- 🌈 Modern gradient design
- ⚡ Lightning-fast performance
- 🔔 Beautiful SweetAlert2 notifications
- 🎭 Smooth animations and transitions

---

## 🚀 Quick Start

### Prerequisites
```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/HilmanThoriq/hitdropzone.git
cd hitdropzone
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure Firebase & Supabase**

Create your Firebase project and Supabase project, then update `src/App.jsx`:
```javascript
// Firebase Configuration
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Supabase Configuration
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";
```

4. **Run development server**
```bash
npm run dev
```

5. **Open browser**
```
http://localhost:5173
```

---

## 📦 Build & Deploy

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
# Login to Firebase
firebase login

# Initialize Firebase (first time only)
firebase init hosting

# Deploy
firebase deploy --only hosting
```

Your app will be live at: `https://your-project.web.app` 🎉

---

## 🏗️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 18 + Vite |
| **Styling** | Tailwind CSS 3 |
| **UI Components** | Lucide React Icons |
| **Notifications** | SweetAlert2 |
| **Database** | Firebase Firestore |
| **Storage** | Supabase Storage |
| **Hosting** | Firebase Hosting |
| **QR Generation** | qrcode.js |
| **ZIP Creation** | JSZip |

---

## 📂 Project Structure
```
hitdropzone/
├── public/              # Static assets
├── src/
│   ├── App.jsx         # Main application component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles (Tailwind)
├── .firebaserc         # Firebase configuration
├── firebase.json       # Firebase hosting config
├── package.json        # Dependencies
├── tailwind.config.js  # Tailwind configuration
└── vite.config.js      # Vite configuration
```

---

## 🎯 Usage Guide

### Uploading Files

1. Click **Upload** tab
2. Enter folder name and owner name
3. Set a 4+ digit PIN (numbers only)
4. Select files (max 100MB per file, 1GB total)
5. Click **Upload Sekarang**
6. Optionally generate QR code for sharing

### Downloading Files

1. Click **Download** tab
2. Find your folder (or scan QR code)
3. Click **Buka Folder** and enter PIN
4. Download individual files or all as ZIP

### Sharing Folders

- **📱 QR Code**: Generate after upload, scan to download
- **🔗 Share Link**: Click share button, enter PIN to get link
- **⚠️ Security**: Links contain PINs, share privately only

---

## 🔒 File Limitations

| Limit | Value |
|-------|-------|
| Max file size | 100 MB per file |
| Max folder size | 1 GB total |
| File retention | 7 days (auto-delete) |
| Supabase storage | 1 GB (free tier) |
| Firestore reads | 50k per day (free tier) |

---

## 🐛 Known Issues

- [ ] ZIP files do not support password protection (browser limitation)
- [ ] Large file uploads may timeout on slow connections
- [ ] QR codes are PNG format 


---


## 👨‍💻 Author

**Hilman Thoriq**

- GitHub: [@HilmanThoriq](https://github.com/HilmanThoriq)  
- Instagram: [@hillmanthrq](https://instagram.com/hillmanthrq)  
- LinkedIn: [Hilman Thoriq](https://linkedin.com/in/hilman-thoriq)
- Portfolio: [hilmanthq.com](https://hilmanthq.com)

---

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI framework
- [Firebase](https://firebase.google.com/) - Backend infrastructure
- [Supabase](https://supabase.com/) - File storage
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [SweetAlert2](https://sweetalert2.github.io/) - Beautiful alerts
- [Lucide](https://lucide.dev/) - Icon library

---

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/HilmanThoriq/hitdropzone?style=social)
![GitHub forks](https://img.shields.io/github/forks/HilmanThoriq/hitdropzone?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/HilmanThoriq/hitdropzone?style=social)

---

<div align="center">

### ⭐ Star this repo if you find it useful!

Made with ❤️ by [Hilman Thoriq](https://github.com/HilmanThoriq)

</div>
```

---

## 🎉 RELEASE NOTES v1.1.1

### 📋 Release Title
```
🚀 HitDropZone v1.1.1 - First Stable Release
Lightning-Fast File Transit Platform