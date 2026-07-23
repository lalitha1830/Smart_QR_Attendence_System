import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import jsQR from 'jsqr';
import {
  ScanLine, Camera, CameraOff, CheckCircle2, XCircle, Clock, BookOpen,
  User, AlertTriangle, RefreshCw, QrCode, Zap, ArrowRight, Info, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { decodeQrToken, generateDeviceFingerprint, getClientIP } from '../../lib/qr';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui';
import { formatDateTime } from '../../lib/utils';
import type { AttendanceSession, Subject, Profile } from '../../types';

interface ScanResult {
  success: boolean;
  subject?: string;
  faculty?: string;
  timestamp?: string;
  error?: string;
}

type ScanPhase = 'idle' | 'scanning' | 'success' | 'error';

export default function StudentScan() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [tokenInput, setTokenInput] = useState('');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScannedToken = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);

  // Keep latest handleScan in a ref so the rAF loop always calls the fresh closure
  const handleScanRef = useRef<(rawToken: string) => void>(() => {});

  /* ---------- Camera management ---------- */

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current !== null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraStarting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      let friendly = 'Camera not available. You can still paste a QR token manually below.';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        friendly = 'Camera permission denied. Please allow camera access in your browser settings, or paste the QR token manually below.';
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        friendly = 'No camera found on this device. You can paste the QR token manually below.';
      } else if (msg.includes('NotReadable')) {
        friendly = 'Camera is in use by another application. Close it and try again, or paste the token manually.';
      }
      setCameraError(friendly);
      setCameraActive(false);
      setCameraStarting(false);
    }
  }, []);

  /* ---------- QR decoding from camera frames ---------- */

  // The rAF loop reads handleScanRef so it always calls the latest handleScan
  // (which has access to the current profile). This avoids stale closure bugs.
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !streamRef.current) {
      scanLoopRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (video.readyState >= 2) {
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            const now = Date.now();
            if (
              code.data !== lastScannedToken.current ||
              now - lastScanTime.current > 3000
            ) {
              lastScannedToken.current = code.data;
              lastScanTime.current = now;
              handleScanRef.current(code.data);
              return;
            }
          }
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(processFrame);
  }, []);

  // Start the scan loop when camera becomes active
  useEffect(() => {
    if (cameraActive) {
      scanLoopRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (scanLoopRef.current !== null) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [cameraActive, processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  /* ---------- QR submission ---------- */

  const handleScan = useCallback(
    async (rawToken: string) => {
      if (!profile) return;
      const token = rawToken.trim();
      if (!token) {
        toast('Please enter or scan a QR token first.', 'warning');
        return;
      }

      setSubmitting(true);
      setPhase('scanning');
      setResult(null);

      await new Promise((r) => setTimeout(r, 600));

      try {
        // 1. Try decoding as a QR token first
        const decoded = decodeQrToken(token);
        let session: (AttendanceSession & { subject: Subject; faculty: Profile }) | null = null;

        if (decoded && decoded.sid) {
          // It's a full QR token — look up by session ID
          const { data, error } = await supabase
            .from('attendance_sessions')
            .select('*, subject:subjects(*), faculty:profiles(*)')
            .eq('id', decoded.sid)
            .maybeSingle();
          if (error) throw new Error('Failed to verify attendance session.');
          session = data as (AttendanceSession & { subject: Subject; faculty: Profile }) | null;
        } else {
          // Not a QR token — try matching by manual_code (case-insensitive)
          const { data, error } = await supabase
            .from('attendance_sessions')
            .select('*, subject:subjects(*), faculty:profiles(*)')
            .eq('manual_code', token.toUpperCase())
            .eq('status', 'active')
            .maybeSingle();
          if (error) throw new Error('Failed to verify attendance session.');
          session = data as (AttendanceSession & { subject: Subject; faculty: Profile }) | null;
        }

        if (!session) {
          throw new Error('No active session found for this code. Check with your faculty.');
        }
        if (session.status !== 'active') {
          throw new Error('This attendance session is no longer active.');
        }

        // 2. Check if QR hasn't expired
        const expiresAt = new Date(session.qr_expires_at).getTime();
        if (Date.now() > expiresAt) {
          throw new Error('This QR code has expired. Ask your faculty to generate a new one.');
        }

        // 3. Check if student already scanned
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('session_id', session.id)
          .eq('student_id', profile.id)
          .maybeSingle();

        if (existing) {
          throw new Error('You have already marked attendance for this session.');
        }

        // 4. Insert attendance record
        const fingerprint = generateDeviceFingerprint();
        const ip = getClientIP();

        const { error: insertErr } = await supabase.from('attendance_records').insert({
          session_id: session.id,
          student_id: profile.id,
          status: 'present',
          marked_method: 'qr',
          marked_at: new Date().toISOString(),
          ip_address: ip,
          device_fingerprint: fingerprint,
          is_flagged: false,
          faculty_approved: false,
        });

        if (insertErr) {
          if (insertErr.code === '23505') {
            throw new Error('You have already marked attendance for this session.');
          }
          throw new Error(insertErr.message);
        }

        // Success!
        setResult({
          success: true,
          subject: session.subject?.name ?? 'Unknown',
          faculty: session.faculty?.full_name ?? 'Unknown',
          timestamp: new Date().toISOString(),
        });
        setPhase('success');
        toast('Attendance marked successfully!', 'success');
        setTokenInput('');
        stopCamera();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong while marking attendance.';
        setResult({ success: false, error: message });
        setPhase('error');
        toast(message, 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [profile, toast, stopCamera],
  );

  // Keep the ref in sync so the rAF loop always calls the latest handleScan
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  const reset = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setTokenInput('');
    lastScannedToken.current = null;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scan QR Code</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Point your camera at the QR code displayed by your faculty, or paste the token manually.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera viewport */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-500" /> Camera Scanner
            </h3>
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              disabled={cameraStarting}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                cameraActive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-400'
              }`}
            >
              {cameraStarting ? (
                <span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…</span>
              ) : cameraActive ? (
                <span className="flex items-center gap-1"><CameraOff className="h-3.5 w-3.5" /> Stop</span>
              ) : (
                <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Start Camera</span>
              )}
            </button>
          </div>

          {/* Camera viewport */}
          <div className="relative aspect-square w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scan overlay frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-3/4 h-3/4">
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                    {/* Animated scan line */}
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent-400 to-transparent shadow-[0_0_12px_2px_rgba(16,185,129,0.6)]"
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                  Scanning… align QR within the frame
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                {cameraError ? (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                      <AlertTriangle className="h-8 w-8 text-amber-500" />
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-400 max-w-xs">{cameraError}</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
                      <QrCode className="h-8 w-8 text-brand-500" />
                    </div>
                    <p className="text-sm text-slate-400">Camera is off</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-xs">
                      Tap "Start Camera" to use your device camera for scanning.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {cameraActive && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              The camera automatically detects QR codes. Keep the code within the frame.
            </p>
          )}
        </div>

        {/* Token input + result */}
        <div className="space-y-6">
          {/* Manual token input */}
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <ScanLine className="h-5 w-5 text-accent-500" /> Enter Attendance Code
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Paste the QR token or type the short manual code shared by your faculty.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan(tokenInput);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="e.g. ABX247 or paste QR token…"
                disabled={submitting}
                className="input-field font-mono text-sm uppercase tracking-widest"
              />
              <Button
                type="submit"
                loading={submitting}
                disabled={!tokenInput.trim() || phase === 'success'}
                className="w-full"
              >
                <Zap className="h-4 w-4" />
                {submitting ? 'Verifying…' : 'Mark Attendance'}
              </Button>
            </form>
          </div>

          {/* Result display */}
          <AnimatePresence mode="wait">
            {phase === 'scanning' && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card p-6"
              >
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="relative">
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-brand-200 dark:border-brand-800"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
                      <RefreshCw className="h-8 w-8 animate-spin" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Verifying attendance…</p>
                  <p className="text-xs text-slate-400">Checking session, expiry, and duplicate scans</p>
                </div>
              </motion.div>
            )}

            {phase === 'success' && result?.success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card p-6 border-accent-200 dark:border-accent-800"
              >
                <div className="flex flex-col items-center text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-600/15 mb-4"
                  >
                    <CheckCircle2 className="h-12 w-12 text-accent-500" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Attendance Marked!</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    You've been marked present for this session.
                  </p>

                  <div className="mt-5 w-full space-y-2.5 text-left">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                      <BookOpen className="h-5 w-5 text-brand-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase text-slate-400 font-medium">Subject</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{result.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                      <User className="h-5 w-5 text-brand-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase text-slate-400 font-medium">Faculty</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{result.faculty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                      <Clock className="h-5 w-5 text-brand-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase text-slate-400 font-medium">Marked At</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatDateTime(result.timestamp!)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3 w-full">
                    <Button variant="secondary" onClick={reset} className="flex-1">
                      <ScanLine className="h-4 w-4" /> Scan Another
                    </Button>
                    <Link to="/student/attendance" className="btn-secondary flex-1">
                      View History <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === 'error' && result && !result.success && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card p-6 border-red-200 dark:border-red-800"
              >
                <div className="flex flex-col items-center text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-600/15 mb-4"
                  >
                    <XCircle className="h-12 w-12 text-red-500" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scan Failed</h3>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2 max-w-sm">{result.error}</p>
                  <Button variant="secondary" onClick={reset} className="mt-5">
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Info card */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400 flex-shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">How QR attendance works</h4>
            <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <li>• Your faculty generates a unique QR code at the start of each class.</li>
              <li>• Scan or paste the token before it expires to mark yourself present.</li>
              <li>• Each QR code can only be used once per student — no duplicate scans.</li>
              <li>• Your device fingerprint and IP are recorded for security verification.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
