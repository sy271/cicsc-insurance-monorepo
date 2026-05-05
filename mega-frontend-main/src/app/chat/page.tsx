'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { analyzeWithAI } from '@/lib/api';
import { toast } from 'sonner';
import { ChatDrawer } from '@/components/chat-drawer';

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
    } catch (error: any) {
      console.error('Error analyzing files:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      toast.error(`Error analyzing files: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="container mx-auto p-4 max-w-4xl">

      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-8 rounded-lg text-center mb-4 ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        {isAnalyzing ? (
          <p>Analyzing files...</p>
        ) : (
          <p>Drag and drop files here, or click to select files</p>
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
