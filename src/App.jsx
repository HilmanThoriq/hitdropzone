import React, { useState, useEffect } from 'react';
import { Upload, Download, Folder, Lock, File, Trash2, Eye, EyeOff, Clock, User, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// ========== FIREBASE CONFIG (untuk Firestore & Hosting) ==========
const firebaseConfig = {
  apiKey: "AIzaSyDqLSahUVAotf62tqZK9HXomJTLsL0vlxA",
  authDomain: "hitdropzone-3ab8a.firebaseapp.com",
  projectId: "hitdropzone-3ab8a",
  storageBucket: "hitdropzone-3ab8a.firebasestorage.app",
  messagingSenderId: "883532943273",
  appId: "1:883532943273:web:66ac5cdfbdbc47405a7eb8",
  measurementId: "G-X0Z6X1KZY8"
};

// ========== SUPABASE CONFIG (untuk Storage) ==========
const supabaseUrl = "https://cupidqvelyeqjdcbsoze.supabase.co"; 
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cGlkcXZlbHllcWpkY2Jzb3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5Nzc1MjAsImV4cCI6MjA3NTU1MzUyMH0.lZEruf8FGZGH9fORHriOJuRyxgRV2FnisG2d1wFVKnk";

// Initialize Firebase & Supabase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [folders, setFolders] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFolders();
    deleteExpiredFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const foldersRef = collection(db, 'folders');
      const q = query(foldersRef, orderBy('uploadDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const foldersData = [];
      querySnapshot.forEach((doc) => {
        foldersData.push({ id: doc.id, ...doc.data() });
      });
      
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat Data',
        text: 'Terjadi kesalahan saat memuat folder',
        confirmButtonColor: '#4F46E5',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteExpiredFolders = async () => {
    try {
      const foldersRef = collection(db, 'folders');
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
                  .from('folders')
                  .remove([file.storagePath]);
                if (error) console.error('Error deleting file:', error);
              } catch (err) {
                console.error('Error deleting file:', err);
              }
            }
          }
          
          await deleteDoc(doc(db, 'folders', docSnapshot.id));
        }
      });
    } catch (error) {
      console.error('Error deleting expired folders:', error);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    const invalidFiles = files.filter(file => file.size > 100 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'File Terlalu Besar',
        text: `Beberapa file melebihi 100MB: ${invalidFiles.map(f => f.name).join(', ')}`,
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    const currentTotal = uploadFiles.reduce((sum, f) => sum + f.size, 0);
    const newTotal = currentTotal + files.reduce((sum, f) => sum + f.size, 0);
    
    if (newTotal > 1024 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Kapasitas Folder Penuh',
        text: 'Total ukuran file tidak boleh melebihi 1GB per folder',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    setUploadFiles([...uploadFiles, ...files]);
  };

  const removeFile = (index) => {
    setUploadFiles(uploadFiles.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const showPrivacyWarning = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '⚠️ Peringatan Privasi & Keamanan',
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
      confirmButtonText: 'Saya Mengerti, Lanjutkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'swal-wide',
        confirmButton: 'swal-button-fix',
        cancelButton: 'swal-button-fix'
      }
    });

    return result.isConfirmed;
  };

  const handleUpload = async () => {
    if (!folderName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nama Folder Kosong',
        text: 'Silakan masukkan nama folder',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    if (!ownerName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nama Pemilik Kosong',
        text: 'Silakan masukkan nama pemilik folder',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    if (!passcode.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'PIN Kosong',
        text: 'Silakan masukkan PIN',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    if (!/^\d+$/.test(passcode)) {
      Swal.fire({
        icon: 'warning',
        title: 'PIN Harus Angka',
        text: 'PIN hanya boleh berisi angka (0-9)',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    if (passcode.length < 4) {
      Swal.fire({
        icon: 'warning',
        title: 'PIN Terlalu Pendek',
        text: 'PIN harus minimal 4 digit',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    if (uploadFiles.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Tidak Ada File',
        text: 'Silakan pilih file untuk diunggah',
        confirmButtonColor: '#4F46E5',
      });
      return;
    }

    const agreed = await showPrivacyWarning();
    if (!agreed) return;

    try {
      Swal.fire({
        title: 'Mengunggah...',
        html: 'Mohon tunggu, file sedang diunggah ke server<br><b>0%</b>',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const folderId = Date.now().toString();
      const uploadedFiles = [];
      const totalSize = uploadFiles.reduce((sum, f) => sum + f.size, 0);

      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        const fileName = `${Date.now()}_${file.name}`;
        const storagePath = `${folderId}/${fileName}`;
        
        const { error } = await supabase.storage
          .from('folders')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          throw new Error(`Gagal upload ${file.name}: ${error.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('folders')
          .getPublicUrl(storagePath);
        
        uploadedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          downloadURL: urlData.publicUrl,
          storagePath: storagePath
        });

        const progress = Math.round(((i + 1) / uploadFiles.length) * 100);
        Swal.update({
          html: `Mohon tunggu, file sedang diunggah ke server<br><b>${progress}%</b>`
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
        expiryDate: Date.now() + (7 * 24 * 60 * 60 * 1000)
      };

      await addDoc(collection(db, 'folders'), folderData);
      
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        html: `Folder "${folderName}" berhasil diunggah dengan ${uploadedFiles.length} file<br><small style="color: #6B7280;">File akan otomatis terhapus dalam 7 hari</small>`,
        confirmButtonColor: '#10B981',
      });

      setFolderName('');
      setOwnerName('');
      setPasscode('');
      setUploadFiles([]);
      setShowPasscode(false);
      await loadFolders();
    } catch (error) {
      console.error('Upload error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunggah',
        text: error.message || 'Terjadi kesalahan saat mengunggah file',
        confirmButtonColor: '#EF4444',
      });
    }
  };

  const handleDownload = (folder) => {
    Swal.fire({
      title: 'Masukkan PIN',
      html: `<p style="margin-bottom: 15px;">PIN untuk folder "<strong>${folder.name}</strong>"</p>
             <p style="font-size: 14px; color: #6B7280; margin-bottom: 10px;">Pemilik: <strong>${folder.ownerName}</strong></p>`,
      input: 'number',
      inputPlaceholder: 'Masukkan PIN (hanya angka)',
      inputAttributes: {
        maxlength: 10,
        autocomplete: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'Buka',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      customClass: {
        confirmButton: 'swal-button-fix',
        cancelButton: 'swal-button-fix'
      },
      inputValidator: (value) => {
        if (!value) {
          return 'PIN tidak boleh kosong!';
        }
        if (!/^\d+$/.test(value)) {
          return 'PIN hanya boleh berisi angka!';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value === folder.passcode) {
          setSelectedFolder(folder);
          Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: 'Folder berhasil dibuka',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'PIN Salah',
            text: 'Silakan coba lagi',
            confirmButtonColor: '#EF4444',
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
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'Download Dimulai',
        text: `File "${file.name}" sedang diunduh`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Download error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Download',
        text: 'Terjadi kesalahan saat mengunduh file',
        confirmButtonColor: '#EF4444',
      });
    }
  };

  const downloadAllFiles = async (folder) => {
    Swal.fire({
      title: 'Download Semua File',
      text: `${folder.files.length} file akan diunduh satu per satu`,
      icon: 'info',
      confirmButtonColor: '#10B981',
    });

    for (let i = 0; i < folder.files.length; i++) {
      await new Promise(resolve => setTimeout(resolve, i * 1000));
      await downloadFile(folder.files[i]);
    }
  };

  const deleteFolder = async (folder) => {
    const { value: enteredPin } = await Swal.fire({
      title: 'Hapus Folder?',
      html: `
        <p style="margin-bottom: 15px;">Folder "<strong>${folder.name}</strong>" dan semua file di dalamnya akan dihapus permanen</p>
        <p style="font-size: 14px; color: #DC2626; margin-bottom: 15px;">⚠️ Tindakan ini tidak dapat dibatalkan!</p>
      `,
      input: 'number',
      inputLabel: 'Masukkan PIN untuk konfirmasi',
      inputPlaceholder: 'PIN folder',
      inputAttributes: {
        maxlength: 10,
        autocomplete: 'off'
      },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      customClass: {
        confirmButton: 'swal-button-fix',
        cancelButton: 'swal-button-fix'
      },
      inputValidator: (value) => {
        if (!value) {
          return 'PIN tidak boleh kosong!';
        }
        if (!/^\d+$/.test(value)) {
          return 'PIN hanya boleh berisi angka!';
        }
      }
    });

    if (!enteredPin) return;

    if (enteredPin !== folder.passcode) {
      Swal.fire({
        icon: 'error',
        title: 'PIN Salah',
        text: 'PIN yang Anda masukkan tidak sesuai',
        confirmButtonColor: '#EF4444',
      });
      return;
    }

    try {
      Swal.fire({
        title: 'Menghapus...',
        text: 'Mohon tunggu',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      for (const file of folder.files) {
        try {
          const { error } = await supabase.storage
            .from('folders')
            .remove([file.storagePath]);
          if (error) console.error('Error deleting file:', error);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }

      await deleteDoc(doc(db, 'folders', folder.id));
      
      setSelectedFolder(null);
      await loadFolders();
      
      Swal.fire({
        icon: 'success',
        title: 'Terhapus!',
        text: 'Folder berhasil dihapus',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Delete error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menghapus',
        text: 'Terjadi kesalahan saat menghapus folder',
        confirmButtonColor: '#EF4444',
      });
    }
  };

  const getRemainingDays = (uploadDate) => {
    const expiry = uploadDate + (7 * 24 * 60 * 60 * 1000);
    const remaining = expiry - Date.now();
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return days > 0 ? days : 0;
  };

  const filteredFolders = folders.filter(folder => {
    const searchLower = searchQuery.toLowerCase();
    return (
      folder.name.toLowerCase().includes(searchLower) ||
      folder.ownerName.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <style>{`
        .swal-wide {
          width: 600px !important;
          max-width: 90% !important;
        }
        .swal-button-fix {
          padding: 10px 24px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          border-radius: 6px !important;
          border: none !important;
          cursor: pointer !important;
        }
        .swal2-actions {
          gap: 10px !important;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            HitDropZone
          </h1>
          <p className="text-gray-600">
            Platform berbagi file tanpa registrasi - Cepat, Mudah, Aman
          </p>
          <p className="text-sm text-orange-600 mt-2">
            ⏰ File otomatis terhapus setelah 7 hari
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 shadow-md max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Upload className="inline w-5 h-5 mr-2" />
            Upload
          </button>
          <button
            onClick={() => {
              setActiveTab('download');
              setSelectedFolder(null);
            }}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all ${
              activeTab === 'download'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Download className="inline w-5 h-5 mr-2" />
            Download
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          {activeTab === 'upload' ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">⚠️ Peringatan Keamanan</p>
                  <p>Website ini TIDAK aman untuk file sensitif/rahasia. Hanya upload file umum yang tidak mengandung data pribadi atau rahasia.</p>
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
                <p className="text-xs text-gray-500 mt-1">Nama ini akan ditampilkan kepada pengguna yang mengunduh</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PIN (hanya angka, min. 4 digit)
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setPasscode(value);
                    }}
                    placeholder="Contoh: 1234"
                    maxLength="10"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">PIN ini diperlukan untuk membuka dan menghapus folder</p>
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
                      Total: {formatFileSize(uploadFiles.reduce((sum, f) => sum + f.size, 0))}
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
                {loading ? 'Mengunggah...' : 'Upload Sekarang'}
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
                        {loading ? 'Memuat...' : '🔄 Refresh'}
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
                        {searchQuery ? 'Folder tidak ditemukan' : 'Belum ada folder yang tersedia'}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
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
                                  <span className="truncate">{folder.ownerName}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(folder.uploadDate).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
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
                            <span>Tersisa {getRemainingDays(folder.uploadDate)} hari</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownload(folder)}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md transition-colors text-sm font-medium"
                            >
                              Buka Folder
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
                          <span>Pemilik: <strong>{selectedFolder.ownerName}</strong></span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {selectedFolder.fileCount} file • {formatFileSize(selectedFolder.totalSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAllFiles(selectedFolder)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                    >
                      Download Semua
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
          <p>⚠️ File tersimpan di Supabase Storage dan akan otomatis terhapus setelah 7 hari</p>
          <p className="mt-2 text-xs">Pastikan Anda sudah mengunduh file sebelum masa berlaku habis</p>
        </div>
      </div>
    </div>
  );
}