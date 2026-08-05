'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { analyzeWithAI } from '@/lib/api';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsAnalyzing(true);

    try {
      const result = await analyzeWithAI(acceptedFiles);

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: 'Please analyze these files.' },
        { role: 'assistant', content: result.response },
      ]);

      toast.success('Files submitted successfully!');
    } catch (error: unknown) {
      console.error('Error analyzing files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Error analyzing files: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Universal Smart Document Classifier</h1>
      <p className="text-muted-foreground mb-4">
        Drop in raw policy PDFs and let AI classify Life, Motor, or Medical while extracting key limits.
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-8 rounded-lg text-center mb-4 ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        {isAnalyzing ? (
          <p>Classifying and extracting policy details...</p>
        ) : (
          <p>Drag and drop policy PDFs here, or click to select files</p>
        )}
      </div>

      <div className="space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === 'assistant'
                ? 'bg-blue-100 ml-4'
                : 'bg-gray-100 mr-4'
            }`}
          >
            <p className="font-semibold mb-1">
              {message.role === 'assistant' ? 'AI' : 'You'}:
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
