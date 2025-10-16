import React, { useState, useEffect } from "react";
import {
  Upload,
  Download,
  Folder,
  Lock,
  File,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  User,
  AlertTriangle,
} from "lucide-react";
import Swal from "sweetalert2";
import QRCode from "qrcode";
import JSZip from "jszip";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

// ========== FIREBASE CONFIG (untuk Firestore & Hosting) ==========
// Ganti hardcoded config dengan env variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Firebase & Supabase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [activeTab, setActiveTab] = useState("upload");
  const [folders, setFolders] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [folderName, setFolderName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    loadFolders();
    deleteExpiredFolders();
  }, []);

  // Handle shared link setelah folders loaded
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const folderId = urlParams.get("folder");
    const pin = urlParams.get("pin");

    if (folderId && pin && folders.length > 0) {
      // Auto-switch ke tab download
      setActiveTab("download");

      // Find folder by ID
      const folder = folders.find((f) => f.id === folderId);

      if (folder && folder.passcode === pin) {
        setSelectedFolder(folder);
        Swal.fire({
          icon: "success",
          title: "Folder Terbuka! 🎉",
          text: `Selamat datang di folder "${folder.name}"`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else if (folder && folder.passcode !== pin) {
        Swal.fire({
          icon: "error",
          title: "PIN Salah",
          text: "Link valid tapi PIN tidak sesuai",
          confirmButtonColor: "#EF4444",
          customClass: {
            confirmButton: "swal-button-visible",
          },
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Folder Tidak Ditemukan",
          text: "Link sudah kadaluarsa atau tidak valid",
          confirmButtonColor: "#EF4444",
          customClass: {
            confirmButton: "swal-button-visible",
          },
        });
      }

      // Clean URL setelah proses
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [folders]); // Trigger saat folders berubah

  const loadFolders = async () => {
    try {
      setLoading(true);
      const foldersRef = collection(db, "folders");
      const q = query(foldersRef, orderBy("uploadDate", "desc"));
      const querySnapshot = await getDocs(q);

      const foldersData = [];
      querySnapshot.forEach((doc) => {
        foldersData.push({ id: doc.id, ...doc.data() });
      });

      setFolders(foldersData);
    } catch (error) {
      console.error("Error loading folders:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Memuat Data",
        text: "Terjadi kesalahan saat memuat folder",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteExpiredFolders = async () => {
    try {
      const foldersRef = collection(db, "folders");
      const querySnapshot = await getDocs(foldersRef);

      const now = Date.now();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

      querySnapshot.forEach(async (docSnapshot) => {
        const folder = docSnapshot.data();
        const uploadDate = folder.uploadDate;

        if (now - uploadDate > sevenDaysInMs) {
          if (folder.files) {
            for (const file of folder.files) {
              try {
                const { error } = await supabase.storage
                  .from("folders")
                  .remove([file.storagePath]);
                if (error) console.error("Error deleting file:", error);
              } catch (err) {
                console.error("Error deleting file:", err);
              }
            }
          }

          await deleteDoc(doc(db, "folders", docSnapshot.id));
        }
      });
    } catch (error) {
      console.error("Error deleting expired folders:", error);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);

    const invalidFiles = files.filter((file) => file.size > 100 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      Swal.fire({
        icon: "error",
        title: "File Terlalu Besar",
        text: `Beberapa file melebihi 100MB: ${invalidFiles
          .map((f) => f.name)
          .join(", ")}`,
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    const currentTotal = uploadFiles.reduce((sum, f) => sum + f.size, 0);
    const newTotal = currentTotal + files.reduce((sum, f) => sum + f.size, 0);

    if (newTotal > 1024 * 1024 * 1024) {
      Swal.fire({
        icon: "error",
        title: "Kapasitas Folder Penuh",
        text: "Total ukuran file tidak boleh melebihi 1GB per folder",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    setUploadFiles([...uploadFiles, ...files]);
  };

  const removeFile = (index) => {
    setUploadFiles(uploadFiles.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFormattedDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}${month}${year}`; // 10122024
  };

  // Sanitize filename untuk menghindari error upload ke Supabase
  const sanitizeFileName = (fileName) => {
    if (!fileName) return "unnamed_file";

    // Pisahkan nama dan extension
    const lastDotIndex = fileName.lastIndexOf(".");
    const name =
      lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";

    // Replace karakter illegal dengan underscore (NO ESCAPE untuk [ dan ? di dalam character class)
    const sanitizedName = name
      .replace(/[[\]#%?&=+@!$'"`~<>|\\/:*]/g, "_") // ← FIX: Hapus backslash di [ dan ?
      .replace(/\s+/g, "_") // Ganti spasi dengan underscore
      .replace(/_+/g, "_") // Ganti multiple underscore jadi single
      .replace(/^_+|_+$/g, ""); // Hapus underscore di awal/akhir

    // Jika nama kosong setelah sanitize, gunakan timestamp
    const finalName = sanitizedName || `file_${Date.now()}`;

    return finalName + ext;
  };

  // Generate nama file ZIP dengan format: NamaFolder_NamaPemilik_JamMenitDetik_DDMMYYYY.zip
  const getZipFileName = (folderName, ownerName) => {
    const now = new Date();

    // Format tanggal: DDMMYYYY
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;

    // Format waktu: JamMenitDetik (HHMMSS)
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timeStr = `${hours}${minutes}${seconds}`;

    // Sanitize folder name dan owner name
    const sanitizedFolder = folderName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    const sanitizedOwner = ownerName
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    // Format: NamaFolder_NamaPemilik_HHMMSS_DDMMYYYY.zip
    return `${sanitizedFolder}_${sanitizedOwner}_${timeStr}_${dateStr}.zip`;
  };

  const generateShareLink = (folder) => {
    // Generate link dengan format: domain.com?folder=ID&pin=PIN
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}?folder=${folder.id}&pin=${folder.passcode}`;
    return shareUrl;
  };

  const copyShareLink = async (folder) => {
    // Minta PIN dulu sebelum copy link
    const { value: enteredPin } = await Swal.fire({
      title: "Verifikasi PIN",
      html: `
      <p style="margin-bottom: 15px;">Masukkan PIN untuk mendapatkan link berbagi folder "<strong>${folder.name}</strong>"</p>
      <p style="font-size: 12px; color: #DC2626; margin-bottom: 10px;">⚠️ Link ini berisi PIN, jaga kerahasiaannya!</p>
    `,
      input: "number",
      inputLabel: "Masukkan PIN",
      inputPlaceholder: "PIN folder",
      inputAttributes: {
        maxlength: 10,
        autocomplete: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Dapatkan Link",
      cancelButtonText: "Batal",
      confirmButtonColor: "#4F46E5",
      cancelButtonColor: "#6B7280",
      customClass: {
        confirmButton: "swal-button-visible",
        cancelButton: "swal-button-visible",
      },
      inputValidator: (value) => {
        if (!value) {
          return "PIN tidak boleh kosong!";
        }
        if (!/^\d+$/.test(value)) {
          return "PIN hanya boleh berisi angka!";
        }
      },
    });

    // Jika user cancel
    if (!enteredPin) return;

    // Cek PIN
    if (enteredPin !== folder.passcode) {
      Swal.fire({
        icon: "error",
        title: "PIN Salah",
        text: "PIN yang Anda masukkan tidak sesuai",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    // PIN benar, generate dan copy link
    const shareLink = generateShareLink(folder);

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(shareLink);

      Swal.fire({
        icon: "success",
        title: "Link Berhasil Disalin! 🎉",
        html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 10px; font-size: 14px;">Link telah disalin ke clipboard:</p>
          <div style="padding: 12px; background: #F3F4F6; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 11px; border: 1px solid #D1D5DB;">
            ${shareLink}
          </div>
          
          <div style="margin-top: 15px; padding: 12px; background: #FEF3C7; border-radius: 6px; border: 1px solid #FDE68A;">
            <p style="margin: 0; font-size: 12px; color: #92400E; font-weight: 600;">⚠️ PERINGATAN KEAMANAN</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #78350F;">
              • Link ini berisi PIN folder<br>
              • Siapa saja yang punya link bisa akses folder<br>
              • Bagikan hanya ke orang terpercaya<br>
              • Jangan posting di media sosial publik
            </p>
          </div>

          <p style="margin-top: 12px; font-size: 12px; color: #6B7280; text-align: center;">
            📤 Bagikan link via WA/Email/DM pribadi
          </p>
        </div>
      `,
        width: 550,
        confirmButtonColor: "#10B981",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    } catch {
      // Fallback jika clipboard API tidak support
      Swal.fire({
        icon: "info",
        title: "Link Berbagi",
        html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 10px; font-size: 14px;">Salin link di bawah ini:</p>
          <textarea 
            id="share-link-text" 
            readonly 
            style="width: 100%; padding: 12px; background: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 6px; font-family: monospace; font-size: 11px; resize: none;"
            rows="3"
          >${shareLink}</textarea>
          <button 
            id="copy-btn" 
            style="margin-top: 10px; padding: 8px 16px; background: #4F46E5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; width: 100%;"
          >
            📋 Salin Link
          </button>
          
          <div style="margin-top: 15px; padding: 12px; background: #FEF3C7; border-radius: 6px; border: 1px solid #FDE68A;">
            <p style="margin: 0; font-size: 11px; color: #92400E; font-weight: 600;">⚠️ Link ini berisi PIN</p>
            <p style="margin: 5px 0 0 0; font-size: 10px; color: #78350F;">Bagikan hanya ke orang terpercaya!</p>
          </div>
        </div>
      `,
        width: 500,
        showConfirmButton: true,
        confirmButtonText: "Tutup",
        confirmButtonColor: "#6B7280",
        customClass: {
          confirmButton: "swal-button-visible",
        },
        didOpen: () => {
          const textarea = document.getElementById("share-link-text");
          const copyBtn = document.getElementById("copy-btn");

          textarea.select();

          copyBtn.addEventListener("click", () => {
            textarea.select();
            document.execCommand("copy");
            copyBtn.innerHTML = "✅ Tersalin!";
            copyBtn.style.background = "#10B981";
            setTimeout(() => {
              copyBtn.innerHTML = "📋 Salin Link";
              copyBtn.style.background = "#4F46E5";
            }, 2000);
          });
        },
      });
    }
  };

  const generateQRCode = async (
    folderId,
    folderName,
    passcode,
    zipDownloadUrl
  ) => {
    try {
      // QR Code langsung ke download ZIP
      const qrData = zipDownloadUrl; // Direct download link!

      // Generate QR code sebagai JPEG
      const qrDataURL = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        type: "image/jpeg",
        quality: 0.95,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return qrDataURL;
    } catch (error) {
      console.error("Error generating QR:", error);
      return null;
    }
  };

  const createDownloadableZipLink = async (folderData, uploadedFilesData) => {
    try {
      // Jika hanya 1 file, return direct download link (tidak perlu ZIP)
      if (uploadedFilesData.length === 1) {
        return uploadedFilesData[0].downloadURL;
      }

      // Jika lebih dari 1 file, buat ZIP
      const zip = new JSZip();

      for (const file of uploadedFilesData) {
        const response = await fetch(file.downloadURL);
        const blob = await response.blob();
        zip.file(file.name, blob);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFileName = `${folderData.folderId}/${getZipFileName(
        folderData.folderName,
        folderData.ownerName
      )}`;

      const { error } = await supabase.storage
        .from("folders")
        .upload(zipFileName, zipBlob, {
          contentType: "application/zip",
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("folders")
        .getPublicUrl(zipFileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error creating downloadable ZIP:", error);
      return null;
    }
  };

  const downloadQRCode = (folderName, qrDataUrl) => {
    if (!qrDataUrl || !folderName) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Data QR Code tidak lengkap",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    try {
      const dateStr = getFormattedDate(); // 10122024
      const sanitizedName = folderName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `QR_${sanitizedName}_${dateStr}.png`;

      const base64Data = qrDataUrl.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      Swal.fire({
        icon: "success",
        title: "QR Code Berhasil Diunduh!",
        text: `File: ${fileName}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error downloading QR:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Download",
        text: "Terjadi kesalahan saat mengunduh QR Code",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    }
  };

  const createZipWithPassword = async (folder) => {
    try {
      Swal.fire({
        title: "Membuat ZIP...",
        text: "Mohon tunggu",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const zip = new JSZip();

      // Download semua file dan masukkan ke zip
      for (const file of folder.files) {
        const response = await fetch(file.downloadURL);
        const blob = await response.blob();
        zip.file(file.name, blob);
      }

      // Generate zip dengan password
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });

      // Download zip
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getZipFileName(folder.name, folder.ownerName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const zipFileName = getZipFileName(folder.name, folder.ownerName);

      Swal.fire({
        icon: "success",
        title: "ZIP Berhasil Dibuat!",
        html: `
          <p>File ZIP telah diunduh.</p>
          <p style="margin-top: 10px; font-size: 12px; color: #6B7280;">
            <strong>Nama file:</strong><br>
            <code style="font-size: 11px; word-break: break-all;">${zipFileName}</code>
          </p>
          <p style="margin-top: 10px; padding: 10px; background: #DBEAFE; border-radius: 6px;">
            ℹ️ File ZIP ini <strong>tidak memiliki password</strong><br>
            <span style="font-size: 12px; color: #1E3A8A;">Semua file dapat langsung diekstrak</span>
          </p>
        `,
        confirmButtonColor: "#10B981",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    } catch (error) {
      console.error("Error creating zip:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Membuat ZIP",
        text: "Terjadi kesalahan saat membuat file ZIP",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    }
  };

  const showPrivacyWarning = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "⚠️ Peringatan Privasi & Keamanan",
      html: `
        <div style="text-align: left; padding: 10px;">
          <p style="margin-bottom: 15px; font-weight: 600; color: #DC2626;">
            PENTING! Harap dibaca dengan seksama:
          </p>
          <ul style="text-align: left; line-height: 1.8; color: #374151;">
            <li>🔓 <strong>Website ini TIDAK terenkripsi end-to-end</strong></li>
            <li>📁 Hanya upload file yang bersifat <strong>UMUM dan TIDAK SENSITIF</strong></li>
            <li>❌ <strong>JANGAN</strong> upload dokumen rahasia/pribadi seperti:
              <ul style="margin-top: 8px; margin-left: 20px;">
                <li>KTP, SIM, Paspor, atau identitas pribadi</li>
                <li>Dokumen negara atau dokumen rahasia perusahaan</li>
                <li>Data keuangan, password, atau informasi sensitif lainnya</li>
              </ul>
            </li>
            <li>⚠️ File Anda dapat diakses oleh siapa saja yang memiliki PIN</li>
            <li>🗑️ File akan otomatis terhapus setelah 7 hari</li>
          </ul>
          <p style="margin-top: 20px; font-weight: 600; color: #DC2626;">
            Dengan melanjutkan, Anda bertanggung jawab penuh atas file yang diunggah.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Saya Mengerti, Lanjutkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#6B7280",
      customClass: {
        popup: "swal-wide",
        confirmButton: "swal-button-visible",
        cancelButton: "swal-button-visible",
      },
    });

    return result.isConfirmed;
  };

  const validatePin = (pin) => {
    if (!pin.trim()) {
      setPinError("");
      return false;
    }
    if (pin.length < 4) {
      setPinError("PIN harus minimal 4 digit");
      return false;
    }
    setPinError("");
    return true;
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setPasscode(value);
    if (value.length > 0) {
      validatePin(value);
    } else {
      setPinError("");
    }
  };

  const handlePinBlur = () => {
    if (passcode.trim()) {
      validatePin(passcode);
    }
  };

  const handleUpload = async () => {
    if (!folderName.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Nama Folder Kosong",
        text: "Silakan masukkan nama folder",
        confirmButtonColor: "#F59E0B",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    if (!ownerName.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Nama Pemilik Kosong",
        text: "Silakan masukkan nama pemilik folder",
        confirmButtonColor: "#F59E0B",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    if (!passcode.trim()) {
      setPinError("PIN tidak boleh kosong");
      Swal.fire({
        icon: "warning",
        title: "PIN Kosong",
        text: "Silakan masukkan PIN",
        confirmButtonColor: "#F59E0B",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    if (!/^\d+$/.test(passcode)) {
      setPinError("PIN hanya boleh berisi angka (0-9)");
      Swal.fire({
        icon: "warning",
        title: "PIN Harus Angka",
        text: "PIN hanya boleh berisi angka (0-9)",
        confirmButtonColor: "#F59E0B",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    if (passcode.length < 4) {
      setPinError("PIN harus minimal 4 digit");
      Swal.fire({
        icon: "warning",
        title: "PIN Terlalu Pendek",
        text: "PIN harus minimal 4 digit",
        confirmButtonColor: "#F59E0B",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    if (uploadFiles.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Tidak Ada File",
        text: "Silakan pilih file untuk diunggah",
        confirmButtonColor: "#F59E0B",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    const agreed = await showPrivacyWarning();
    if (!agreed) return;

    try {
      Swal.fire({
        title: "Mengunggah...",
        html: "Mohon tunggu, file sedang diunggah ke server<br><b>0%</b>",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const folderId = Date.now().toString();
      const uploadedFiles = [];
      const totalSize = uploadFiles.reduce((sum, f) => sum + f.size, 0);

      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        const sanitizedFileName = sanitizeFileName(file.name); // ← Sanitize
        const existingNames = uploadedFiles.map((f) =>
          f.storagePath.split("/").pop()
        );
        let counter = 1;
        let finalFileName = sanitizedFileName;

        // Jika duplicate, tambah counter
        while (existingNames.includes(finalFileName)) {
          const lastDotIndex = sanitizedFileName.lastIndexOf(".");
          const name =
            lastDotIndex !== -1
              ? sanitizedFileName.substring(0, lastDotIndex)
              : sanitizedFileName;
          const ext =
            lastDotIndex !== -1
              ? sanitizedFileName.substring(lastDotIndex)
              : "";
          finalFileName = `${name}_${counter}${ext}`;
          counter++;
        }

        const storagePath = `${folderId}/${finalFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("folders")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Gagal upload ${file.name}: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from("folders")
          .getPublicUrl(storagePath);

        uploadedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          downloadURL: urlData.publicUrl,
          storagePath: storagePath,
        });

        const progress = Math.round(((i + 1) / uploadFiles.length) * 100);
        Swal.update({
          html: `Mohon tunggu, file sedang diunggah ke server<br><b>${progress}%</b>`,
        });
      }

      const folderData = {
        name: folderName,
        ownerName: ownerName,
        passcode: passcode,
        files: uploadedFiles,
        totalSize: totalSize,
        uploadDate: Date.now(),
        fileCount: uploadedFiles.length,
        expiryDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      // Save ke Firestore dan dapatkan ID yang persistent
      const docRef = await addDoc(collection(db, "folders"), folderData);
      const savedFolderId = docRef.id; // ID unik dari Firestore!

      Swal.close(); // Tutup loading dulu

      // Tanya user mau buat QR atau tidak
      const qrResult = await Swal.fire({
        icon: "success",
        title: "Upload Berhasil! 🎉",
        html: `
          <p>Folder "${folderName}" berhasil diunggah dengan ${uploadedFiles.length} file</p>
          <p style="font-size: 14px; color: #6B7280; margin-top: 10px;">File akan otomatis terhapus dalam 7 hari</p>
          <div style="margin: 15px 0; padding: 12px; background: #EEF2FF; border-radius: 8px; border: 2px solid #C7D2FE;">
            <p style="margin: 0; font-size: 13px; color: #4338CA; font-weight: 600;">🔗 Link Berbagi Aktif!</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #6366F1;">
              Link sudah bisa dibagikan sekarang
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #E5E7EB;">
          <p style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">📱 Buat QR Code untuk berbagi?</p>
          <p style="font-size: 12px; color: #6B7280;">Scan QR = Otomatis download ZIP!</p>
        `,
        showCancelButton: true,
        confirmButtonText: "Ya, Buat QR Code",
        cancelButtonText: "Tidak, Terima Kasih",
        confirmButtonColor: "#10B981",
        cancelButtonColor: "#6B7280",
        customClass: {
          confirmButton: "swal-button-visible",
          cancelButton: "swal-button-visible",
        },
      });

      if (qrResult.isConfirmed) {
        // Buat ZIP dan upload ke Supabase
        Swal.fire({
          title: "Membuat QR Code...",
          html: "Sedang memproses file...<br><b>0%</b>",
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        try {
          // Create ZIP and get download URL
          const zipUrl = await createDownloadableZipLink(
            {
              folderId: savedFolderId,
              folderName: folderName,
              passcode: passcode,
            },
            uploadedFiles
          );

          if (!zipUrl) {
            throw new Error("Gagal membuat link download ZIP");
          }

          // Generate QR Code
          const qrDataURL = await generateQRCode(
            savedFolderId,
            folderName,
            passcode,
            zipUrl
          );

          if (qrDataURL) {
            await Swal.close();

            // Sedikit jeda agar animasi penutupan benar-benar selesai
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Tampilkan QR Code
            Swal.fire({
              title: "📱 QR Code Siap!",
              html: `
                  <div style="text-align: center;">
                    <div style="background: #F0FDF4; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                      <p style="margin: 0; color: #10B981; font-weight: 600;">
                        ${
                          uploadedFiles.length === 1
                            ? "✅ Scan = Auto Download File!"
                            : "✅ Scan = Auto Download ZIP!"
                        }
                      </p>
                    </div>
                    
                    <p style="margin-bottom: 15px; color: #6B7280; font-size: 14px;">
                      ${
                        uploadedFiles.length === 1
                          ? "Scan QR Code untuk download file langsung"
                          : "Scan QR Code untuk download semua file (ZIP)"
                      }
                    </p>
                    <div style="position: relative; width: 350px; height: 350px; margin: 0 auto;">
                  <img 
                    src="${qrDataURL}" 
                    style="width: 100%; height: 100%; border: 3px solid #4F46E5; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.15); display: block;"
                    alt="QR Code"
                  >
                </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background: #EEF2FF; border-radius: 8px; border: 2px solid #C7D2FE;">
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #3730A3;">📁 ${folderName}</p>
                      <p style="margin: 8px 0 0 0; font-size: 13px; color: #4338CA;">👤 ${ownerName}</p>
                      <p style="margin: 8px 0 0 0; font-size: 12px; color: #6366F1;">
                        📊 ${uploadedFiles.length} file${
                uploadedFiles.length > 1 ? "s" : ""
              } • ${formatFileSize(totalSize)}
                      </p>
                    </div>

                    <div style="margin-top: 15px; padding: 12px; background: #FFFBEB; border-radius: 8px; border: 2px solid #FDE68A;">
                      <p style="margin: 0; font-size: 12px; color: #92400E; font-weight: 600;">💡 Cara Pakai:</p>
                      <p style="margin: 5px 0 0 0; font-size: 11px; color: #78350F; text-align: left;">
                        1. Simpan/bagikan QR Code ini<br>
                        2. Scan dengan kamera HP<br>
                        3. ${
                          uploadedFiles.length === 1 ? "File" : "ZIP"
                        } otomatis terdownload!
                      </p>
                    </div>

                    <div style="margin-top: 12px; font-size: 11px; color: #6B7280;">
                      <p style="margin: 3px 0;">⏰ File online tersedia selama 7 hari</p>
                    </div>
                  </div>
                `,
              width: 550,
              showCancelButton: true,
              confirmButtonText: "💾 Download QR Code",
              cancelButtonText: "Tutup",
              confirmButtonColor: "#4F46E5",
              cancelButtonColor: "#6B7280",
              customClass: {
                confirmButton: "swal-button-visible",
                cancelButton: "swal-button-visible",
              },
            }).then((downloadResult) => {
              if (downloadResult.isConfirmed) {
                downloadQRCode(folderName, qrDataURL);
              }
            });
          }

        } catch (error) {
          console.error("Error creating QR:", error);
          Swal.fire({
            icon: "error",
            title: "Gagal Membuat QR Code",
            html: `
              <p>${error.message}</p>
              <p style="font-size: 12px; color: #6B7280; margin-top: 10px;">Folder tetap tersimpan, Anda bisa download manual dari tab Download</p>
            `,
            confirmButtonColor: "#EF4444",
            customClass: {
              confirmButton: "swal-button-visible",
            },
          });
        }
      }

      // Reset form
      setFolderName("");
      setOwnerName("");
      setPasscode("");
      setPinError("");
      setUploadFiles([]);
      setShowPasscode(false);
      await loadFolders();
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Mengunggah",
        text: error.message || "Terjadi kesalahan saat mengunggah file",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    }
  };

  const handleDownload = (folder) => {
    Swal.fire({
      title: "Masukkan PIN",
      html: `<p style="margin-bottom: 15px;">PIN untuk folder "<strong>${folder.name}</strong>"</p>
             <p style="font-size: 14px; color: #6B7280; margin-bottom: 10px;">Pemilik: <strong>${folder.ownerName}</strong></p>`,
      input: "number",
      inputPlaceholder: "Masukkan PIN (hanya angka)",
      inputAttributes: {
        maxlength: 10,
        autocomplete: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Buka",
      cancelButtonText: "Batal",
      confirmButtonColor: "#4F46E5",
      cancelButtonColor: "#6B7280",
      customClass: {
        confirmButton: "swal-button-visible",
        cancelButton: "swal-button-visible",
      },
      inputValidator: (value) => {
        if (!value) {
          return "PIN tidak boleh kosong!";
        }
        if (!/^\d+$/.test(value)) {
          return "PIN hanya boleh berisi angka!";
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value === folder.passcode) {
          setSelectedFolder(folder);
          Swal.fire({
            icon: "success",
            title: "Berhasil!",
            text: "Folder berhasil dibuka",
            timer: 1500,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "PIN Salah",
            text: "Silakan coba lagi",
            confirmButtonColor: "#EF4444",
            customClass: {
              confirmButton: "swal-button-visible",
            },
          });
        }
      }
    });
  };

  const downloadFile = async (file) => {
    try {
      const response = await fetch(file.downloadURL);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: "success",
        title: "Download Dimulai",
        text: `File "${file.name}" sedang diunduh`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Download error:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Download",
        text: "Terjadi kesalahan saat mengunduh file",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    }
  };

  const downloadAllFiles = async (folder) => {
    // Jika hanya 1 file, langsung download tanpa popup
    if (folder.files.length === 1) {
      await downloadFile(folder.files[0]);
      return;
    }

    // Jika lebih dari 1 file, tampilkan pilihan
    await Swal.fire({
      title: "Pilih Metode Download",
      html: `
      <p style="margin-bottom: 15px;">Bagaimana Anda ingin mengunduh ${folder.files.length} file?</p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="zip-btn" class="download-option-btn" style="padding: 15px; background: #4F46E5; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
          📦 Download sebagai ZIP<br>
          <small style="font-weight: 400; opacity: 0.9;">Semua file dalam 1 file ZIP</small>
        </button>
        <button id="one-by-one-btn" class="download-option-btn" style="padding: 15px; background: #10B981; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
          📥 Download Satu per Satu<br>
          <small style="font-weight: 400; opacity: 0.9;">File diunduh terpisah</small>
        </button>
      </div>
    `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Batal",
      cancelButtonColor: "#6B7280",
      customClass: {
        cancelButton: "swal-button-visible",
      },
      didOpen: () => {
        document.getElementById("zip-btn").addEventListener("click", () => {
          Swal.clickConfirm();
          Swal.close();
          createZipWithPassword(folder);
        });
        document
          .getElementById("one-by-one-btn")
          .addEventListener("click", async () => {
            Swal.close();
            Swal.fire({
              title: "Download Dimulai",
              text: `${folder.files.length} file akan diunduh satu per satu`,
              icon: "info",
              timer: 2000,
              showConfirmButton: false,
            });
            for (let i = 0; i < folder.files.length; i++) {
              await new Promise((resolve) => setTimeout(resolve, i * 1000));
              await downloadFile(folder.files[i]);

              // Show progress setiap file
              if (i < folder.files.length - 1) {
                Swal.fire({
                  title: `Download Progress`,
                  text: `${i + 1}/${folder.files.length} file terdownload`,
                  icon: "info",
                  timer: 800,
                  showConfirmButton: false,
                });
              }
            }
          });
      },
    });
  };

  const deleteFolder = async (folder) => {
    const { value: enteredPin } = await Swal.fire({
      title: "Hapus Folder?",
      html: `
        <p style="margin-bottom: 15px;">Folder "<strong>${folder.name}</strong>" dan semua file di dalamnya akan dihapus permanen</p>
        <p style="font-size: 14px; color: #DC2626; margin-bottom: 15px;">⚠️ Tindakan ini tidak dapat dibatalkan!</p>
      `,
      input: "number",
      inputLabel: "Masukkan PIN untuk konfirmasi",
      inputPlaceholder: "PIN folder",
      inputAttributes: {
        maxlength: 10,
        autocomplete: "off",
      },
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
      customClass: {
        confirmButton: "swal-button-visible",
        cancelButton: "swal-button-visible",
      },
      inputValidator: (value) => {
        if (!value) {
          return "PIN tidak boleh kosong!";
        }
        if (!/^\d+$/.test(value)) {
          return "PIN hanya boleh berisi angka!";
        }
      },
    });

    if (!enteredPin) return;

    if (enteredPin !== folder.passcode) {
      Swal.fire({
        icon: "error",
        title: "PIN Salah",
        text: "PIN yang Anda masukkan tidak sesuai",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
      return;
    }

    try {
      Swal.fire({
        title: "Menghapus...",
        text: "Mohon tunggu",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      for (const file of folder.files) {
        try {
          const { error } = await supabase.storage
            .from("folders")
            .remove([file.storagePath]);
          if (error) console.error("Error deleting file:", error);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }

      await deleteDoc(doc(db, "folders", folder.id));

      setSelectedFolder(null);
      await loadFolders();

      Swal.fire({
        icon: "success",
        title: "Terhapus!",
        text: "Folder berhasil dihapus",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Delete error:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Menghapus",
        text: "Terjadi kesalahan saat menghapus folder",
        confirmButtonColor: "#EF4444",
        customClass: {
          confirmButton: "swal-button-visible",
        },
      });
    }
  };

  const getRemainingDays = (uploadDate) => {
    const expiry = uploadDate + 7 * 24 * 60 * 60 * 1000;
    const remaining = expiry - Date.now();
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return days > 0 ? days : 0;
  };

  const filteredFolders = folders.filter((folder) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const folderName = folder.name ? folder.name.toLowerCase() : "";
    const ownerName = folder.ownerName ? folder.ownerName.toLowerCase() : "";
    return folderName.includes(searchLower) || ownerName.includes(searchLower);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <style>{`
        .swal-wide {
          width: 600px !important;
          max-width: 90% !important;
        }
        .swal-button-visible {
          display: inline-block !important;
          padding: 10px 24px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          border-radius: 6px !important;
          border: none !important;
          cursor: pointer !important;
          color: white !important;
          opacity: 1 !important;
        }
        .swal-button-visible:hover {
          opacity: 0.9 !important;
          filter: brightness(0.95) !important;
        }
        .swal2-actions {
          gap: 10px !important;
        }
        .swal2-styled.swal2-confirm {
          background-color: var(--confirm-color, #10B981) !important;
        }
        .swal2-styled.swal2-cancel {
          background-color: #6B7280 !important;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        .download-option-btn:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          transition: all 0.2s;
        }
      `}</style>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">HitDropZone</h1>
          <p className="text-gray-600">
            Platform berbagi file tanpa registrasi - Cepat, Mudah, Aman
          </p>
          <p className="text-sm text-orange-600 mt-2">
            ⏰ File otomatis terhapus setelah 7 hari
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 shadow-md max-w-md mx-auto">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all ${
              activeTab === "upload"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Upload className="inline w-5 h-5 mr-2" />
            Upload
          </button>
          <button
            onClick={() => {
              setActiveTab("download");
              setSelectedFolder(null);
            }}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all ${
              activeTab === "download"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Download className="inline w-5 h-5 mr-2" />
            Download
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          {activeTab === "upload" ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">⚠️ Peringatan Keamanan</p>
                  <p>
                    Website ini TIDAK aman untuk file sensitif/rahasia. Hanya
                    upload file umum yang tidak mengandung data pribadi atau
                    rahasia.
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Upload File Anda
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Folder
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Contoh: Dokumen Penting"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  Nama Pemilik Folder
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Contoh: Hilman Thoriq"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nama ini akan ditampilkan kepada pengguna yang mengunduh
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PIN (hanya angka, min. 4 digit)
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? "text" : "password"}
                    value={passcode}
                    onChange={handlePinChange}
                    onBlur={handlePinBlur}
                    placeholder="Contoh: 1234"
                    maxLength="10"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 pr-12 ${
                      pinError
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-transparent"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasscode ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {pinError ? (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    {pinError}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    PIN ini diperlukan untuk membuka dan menghapus folder
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih File (Max 100MB per file, Total max 1GB)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-indigo-500 mb-3" />
                    <span className="text-gray-600 font-medium">
                      Klik untuk pilih file
                    </span>
                    <span className="text-gray-400 text-sm mt-1">
                      PDF, DOCX, Gambar, ZIP, dll.
                    </span>
                  </label>
                </div>
              </div>

              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-700">
                      File Terpilih ({uploadFiles.length})
                    </h3>
                    <span className="text-sm text-gray-600">
                      Total:{" "}
                      {formatFileSize(
                        uploadFiles.reduce((sum, f) => sum + f.size, 0)
                      )}
                    </span>
                  </div>
                  {uploadFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <File className="w-5 h-5 text-indigo-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Mengunggah..." : "Upload Sekarang"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {!selectedFolder ? (
                <>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Folder Tersedia ({filteredFolders.length})
                    </h2>
                    <div className="flex gap-2 w-full md:w-auto">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari nama folder atau pemilik..."
                        className="flex-1 md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={loadFolders}
                        disabled={loading}
                        className="text-indigo-600 hover:text-indigo-700 font-medium text-sm disabled:opacity-50 px-3 py-2 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                      >
                        {loading ? "Memuat..." : "🔄 Refresh"}
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Memuat data...</p>
                    </div>
                  ) : filteredFolders.length === 0 ? (
                    <div className="text-center py-12">
                      <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">
                        {searchQuery
                          ? "Folder tidak ditemukan"
                          : "Belum ada folder yang tersedia"}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="text-indigo-600 hover:text-indigo-700 text-sm mt-2"
                        >
                          Hapus pencarian
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {filteredFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className="border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-indigo-50"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Folder className="w-8 h-8 text-indigo-600 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-800 truncate">
                                  {folder.name}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                                  <User className="w-3 h-3" />
                                  <span className="truncate">
                                    {folder.ownerName}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(
                                    folder.uploadDate
                                  ).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          </div>

                          <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                            <span>{folder.fileCount} file</span>
                            <span>{formatFileSize(folder.totalSize)}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-orange-600 mb-4 bg-orange-50 px-3 py-2 rounded">
                            <Clock className="w-4 h-4" />
                            <span>
                              Tersisa {getRemainingDays(folder.uploadDate)} hari
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownload(folder)}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md transition-colors text-sm font-medium"
                            >
                              Buka Folder
                            </button>
                            <button
                              onClick={() => copyShareLink(folder)}
                              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-md transition-colors"
                              title="Salin link berbagi"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteFolder(folder)}
                              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-md transition-colors"
                              title="Hapus folder (perlu PIN)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedFolder(null)}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        ← Kembali
                      </button>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800">
                          {selectedFolder.name}
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <User className="w-4 h-4" />
                          <span>
                            Pemilik: <strong>{selectedFolder.ownerName}</strong>
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {selectedFolder.fileCount} file •{" "}
                          {formatFileSize(selectedFolder.totalSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAllFiles(selectedFolder)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                    >
                      {selectedFolder.fileCount === 1
                        ? "📥 Download File"
                        : "📦 Download Semua"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedFolder.files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">
                              {file.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadFile(file)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ml-2"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            ⚠️ File tersimpan di Supabase Storage dan akan otomatis terhapus
            setelah 7 hari
          </p>
          <p className="mt-2 text-xs">
            Pastikan Anda sudah mengunduh file sebelum masa berlaku habis
          </p>
        </div>
      </div>
    </div>
  );
}
