'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Sparkles, Check, Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SubmitResult {
  ok: boolean;
  cat_id?: string;
  image_url?: string;
  rarity?: string;
  power?: string;
  stats?: Record<string, number>;
  error?: string;
  details?: string;
}

export default function SubmitCat() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image || !name) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', image);
    formData.append('name', name);

    try {
      const res = await fetch('/api/cats/create', {
        method: 'POST',
        body: formData
      });

      const data: SubmitResult = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.details || data.error || 'Upload failed');
      } else {
        setResult(data);
        setSubmitted(true);
        setTimeout(() => router.push('/'), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setUploading(false);
    }
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Cat Submitted!</h2>
          {result.rarity && (
            <p className="text-yellow-400 font-bold mb-2">{result.rarity}</p>
          )}
          {result.power && (
            <p className="text-white/60 mb-4">Power: {result.power}</p>
          )}
          <p className="text-white/60 mb-6">Redirecting to arena...</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Go now →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Enter Your Cat</h1>
          <p className="text-white/60">Submit your feline warrior to the arena</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-white bg-white/5' : 'border-white/20 hover:border-white/40'
            }`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <div className="relative w-48 h-48 mx-auto rounded-xl overflow-hidden">
                <Image src={preview} alt="Preview" fill className="object-cover" />
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
                <p className="text-white/60">
                  {isDragActive ? 'Drop the image here' : 'Drag & drop a cat photo, or click to select'}
                </p>
                <p className="text-sm text-white/40 mt-2">PNG, JPG up to 5MB</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Cat Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sir Whiskers"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              required
            />
          </div>

          {image && name && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-white/70">
                  Your cat will enter with randomly generated stats and rarity
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!image || !name || uploading}
            className="w-full py-4 rounded-xl bg-white text-black font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Submit Cat'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-white/40 mt-6">
          Submissions are reviewed before appearing in battles
        </p>
      </div>
    </div>
  );
}
