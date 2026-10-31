import React, { useState, useEffect } from 'react';
import {
  X, Upload, FileText, CheckCircle2, AlertTriangle, Search,
  Download, Trash2, Edit3, ShieldCheck, UserCheck, Plus, Check
} from 'lucide-react';
import { Button, Dialog, Badge } from '../ui';

interface AdminKYCModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  mode?: 'UPLOAD' | 'EDIT';
  initialUserId?: string;
  initialApplication?: any;
  onSuccess: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'PAN_CARD', label: 'PAN Card' },
  { value: 'AADHAAR_FRONT', label: 'Aadhaar Card (Front)' },
  { value: 'AADHAAR_BACK', label: 'Aadhaar Card (Back)' },
  { value: 'BANK_PROOF', label: 'Bank Statement / Cancelled Cheque' },
  { value: 'INCOME_PROOF', label: 'Income Proof / ITR / Salary Slip' },
  { value: 'CLIENT_PHOTO', label: 'Client Photograph' },
  { value: 'OTHER', label: 'Other Document' },
];

const STATUS_OPTIONS = [
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved (Mark Verified)' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'RESUBMISSION_REQUIRED', label: 'Resubmission Required' },
];

export const AdminKYCModal: React.FC<AdminKYCModalProps> = ({
  isOpen,
  onClose,
  token,
  mode = 'UPLOAD',
  initialUserId,
  initialApplication,
  onSuccess,
}) => {
  // Client selection
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form Fields
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [status, setStatus] = useState('UNDER_REVIEW');
  const [rejectionReason, setRejectionReason] = useState('');

  // File Upload State
  const [documentType, setDocumentType] = useState('PAN_CARD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Documents list in edit mode
  const [documents, setDocuments] = useState<any[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Status & Messaging
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset and pre-populate on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccessMsg(null);
    setSelectedFile(null);
    setDeletingDocId(null);

    if (initialApplication) {
      setSelectedUser({
        id: initialApplication.user_id,
        username: initialApplication.username,
        email: initialApplication.email,
        full_name: initialApplication.full_name,
        client_id: initialApplication.client_id,
      });
      setPanNumber(initialApplication.pan_number || '');
      setAadhaarNumber(initialApplication.aadhaar_number || '');
      setBankAccountName(initialApplication.bank_account_name || '');
      setBankAccountNumber(initialApplication.bank_account_number || '');
      setBankIfsc(initialApplication.bank_ifsc || '');
      setBankName(initialApplication.bank_name || '');
      setStatus(initialApplication.status || 'UNDER_REVIEW');
      setRejectionReason(initialApplication.rejection_reason || '');
      setDocuments(initialApplication.documents || []);
    } else if (initialUserId) {
      // Fetch user details
      fetch(`/api/v1/admin/kyc/clients-search?q=${encodeURIComponent(initialUserId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.clients && d.clients.length > 0) {
            const c = d.clients[0];
            setSelectedUser(c);
            setPanNumber(c.pan_number || '');
            setAadhaarNumber(c.aadhaar_number || '');
            setBankAccountName(c.bank_account_name || '');
            setBankAccountNumber(c.bank_account_number || '');
            setBankIfsc(c.bank_ifsc || '');
            setBankName(c.bank_name || '');
            setStatus(c.kyc_status || 'UNDER_REVIEW');
          }
        })
        .catch(() => {});
    } else {
      setSelectedUser(null);
      setPanNumber('');
      setAadhaarNumber('');
      setBankAccountName('');
      setBankAccountNumber('');
      setBankIfsc('');
      setBankName('');
      setStatus('UNDER_REVIEW');
      setRejectionReason('');
      setDocuments([]);
    }
  }, [isOpen, initialUserId, initialApplication, token]);

  // Client search debounce
  useEffect(() => {
    if (!searchQuery.trim() || selectedUser) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/v1/admin/kyc/clients-search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.success && Array.isArray(d.clients)) {
            setSearchResults(d.clients);
          }
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedUser, token]);

  const handleSelectClient = (c: any) => {
    setSelectedUser(c);
    setSearchQuery('');
    setSearchResults([]);
    if (c.pan_number) setPanNumber(c.pan_number);
    if (c.aadhaar_number) setAadhaarNumber(c.aadhaar_number);
    if (c.bank_account_name) setBankAccountName(c.bank_account_name);
    if (c.bank_account_number) setBankAccountNumber(c.bank_account_number);
    if (c.bank_ifsc) setBankIfsc(c.bank_ifsc);
    if (c.bank_name) setBankName(c.bank_name);
    if (c.kyc_status) setStatus(c.kyc_status);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this KYC document?')) return;
    setDeletingDocId(docId);
    try {
      const res = await fetch(`/api/v1/admin/kyc/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        alert(data.error?.message || 'Failed to delete document');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const targetUserId = selectedUser?.id || initialUserId || initialApplication?.user_id;
    if (!targetUserId) {
      setError('Please search and select a client first.');
      return;
    }

    setSubmitting(true);

    try {
      if (selectedFile) {
        // Upload document + details via multipart
        const formData = new FormData();
        formData.append('userId', targetUserId);
        if (initialApplication?.id) formData.append('applicationId', initialApplication.id);
        formData.append('documentType', documentType);
        formData.append('panNumber', panNumber.trim().toUpperCase());
        formData.append('aadhaarNumber', aadhaarNumber.trim());
        formData.append('bankAccountName', bankAccountName.trim());
        formData.append('bankAccountNumber', bankAccountNumber.trim());
        formData.append('bankIfsc', bankIfsc.trim().toUpperCase());
        formData.append('bankName', bankName.trim());
        formData.append('status', status);
        formData.append('file', selectedFile);

        const res = await fetch('/api/v1/admin/kyc/admin-upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error?.message || data.error || 'Failed to upload document');
        }
        setSuccessMsg(data.message || 'KYC document and details uploaded successfully!');
      } else if (initialApplication?.id) {
        // Update details via PUT
        const res = await fetch(`/api/v1/admin/kyc/applications/${initialApplication.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            panNumber: panNumber.trim().toUpperCase(),
            aadhaarNumber: aadhaarNumber.trim(),
            bankAccountName: bankAccountName.trim(),
            bankAccountNumber: bankAccountNumber.trim(),
            bankIfsc: bankIfsc.trim().toUpperCase(),
            bankName: bankName.trim(),
            status,
            rejectionReason: status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED' ? rejectionReason : null
          })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error?.message || data.error || 'Failed to update KYC application');
        }
        setSuccessMsg(data.message || 'KYC details updated successfully!');
      } else {
        // Upload details without file
        const res = await fetch('/api/v1/admin/kyc/admin-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: targetUserId,
            panNumber: panNumber.trim().toUpperCase(),
            aadhaarNumber: aadhaarNumber.trim(),
            bankAccountName: bankAccountName.trim(),
            bankAccountNumber: bankAccountNumber.trim(),
            bankIfsc: bankIfsc.trim().toUpperCase(),
            bankName: bankName.trim(),
            status
          })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error?.message || data.error || 'Failed to save KYC details');
        }
        setSuccessMsg(data.message || 'KYC details saved successfully!');
      }

      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]">
              {mode === 'UPLOAD' ? <Upload className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-[var(--text-main)]">
                {mode === 'UPLOAD' ? 'Upload Client KYC Document' : 'Edit Client KYC Application'}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Staff & Admin KYC Verification Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-surface)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {error && (
            <div className="p-3 rounded-xl bg-[var(--loss-light)] border border-[var(--loss)]/30 text-[var(--loss)] font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-[var(--gain-light)] border border-[var(--gain)]/30 text-[var(--gain)] font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Client Search / Selection (if not pre-locked) */}
          <div className="space-y-1.5">
            <label className="font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
              Select Client / Account <span className="text-red-500">*</span>
            </label>

            {selectedUser ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] font-black flex items-center justify-center text-xs">
                    {(selectedUser.username || selectedUser.full_name || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--text-main)] text-xs">
                      {selectedUser.username} {selectedUser.full_name ? `(${selectedUser.full_name})` : ''}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">
                      ID: {selectedUser.client_id || selectedUser.id?.slice(0, 8)} • {selectedUser.email}
                    </div>
                  </div>
                </div>
                {!initialUserId && !initialApplication && (
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="text-[10px] font-bold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    Change Client
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by client ID, name, email, or phone number..."
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl text-xs font-semibold text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                />

                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                    Searching...
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl z-20 divide-y divide-[var(--border-color)]">
                    {searchResults.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className="p-2.5 hover:bg-[var(--bg-surface-elevated)] cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-[var(--text-main)] text-xs">
                            {c.username} {c.full_name ? `(${c.full_name})` : ''}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">
                            {c.client_id} • {c.email} • {c.phone_number || 'No phone'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                          c.is_kyc_completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {c.is_kyc_completed ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Document Upload Field */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-main)] text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
                Upload KYC Proof Document
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">JPG, PNG, PDF up to 15MB</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Document Category</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] font-semibold outline-none focus:border-[var(--primary)]"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Select Document File</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[var(--text-main)] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-[var(--primary)]/20 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/30 cursor-pointer"
                />
              </div>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-[11px] font-bold">
                <span>Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Existing Uploaded Documents (in Edit Mode) */}
          {documents.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                Currently Attached Documents ({documents.length})
              </label>
              <div className="divide-y divide-[var(--border-color)] border border-[var(--border-color)] rounded-xl bg-[var(--bg-surface-inset)] overflow-hidden">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <div>
                        <span className="font-bold text-xs text-[var(--text-main)]">{doc.document_type}</span>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          {doc.original_filename} • {(doc.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/api/v1/admin/kyc/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--primary)] hover:border-[var(--primary)] flex items-center gap-1 text-[10px] font-bold px-2 py-0.5"
                      >
                        <Download className="w-3 h-3" /> View
                      </a>
                      <button
                        type="button"
                        disabled={deletingDocId === doc.id}
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" /> {deletingDocId === doc.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Identification Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">PAN Card Number</label>
              <input
                type="text"
                maxLength={10}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-mono font-bold outline-none focus:border-[var(--primary)] uppercase"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Aadhaar Card Number</label>
              <input
                type="text"
                maxLength={12}
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="12 digit Aadhaar number"
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-mono font-bold outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {/* 5. Bank Account Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Bank Account Holder Name</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="As per bank passbook"
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-bold outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Bank Account Number</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="Enter account number"
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-mono font-bold outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Bank IFSC Code</label>
              <input
                type="text"
                maxLength={11}
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-mono font-bold outline-none focus:border-[var(--primary)] uppercase"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank, ICICI Bank"
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-bold outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {/* 6. Review Status & Decision */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-color)]">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1 uppercase">
                Application Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] font-bold outline-none focus:border-[var(--primary)]"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>

            {(status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED') && (
              <div>
                <label className="block text-[10px] font-bold text-[var(--loss)] mb-1 uppercase">
                  Rejection Reason
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Blurred document, PAN name mismatch"
                  className="w-full bg-[var(--bg-body)] border border-[var(--loss)]/40 rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--loss)] font-bold"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
            <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting || (!selectedUser && !initialUserId && !initialApplication)}>
              {submitting ? 'Saving KYC...' : (mode === 'UPLOAD' ? 'Upload Document & Save' : 'Save KYC Changes')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
