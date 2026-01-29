'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editorStore';
import ProcessingScreen from '@/components/ProcessingScreen';

export default function ExportPage() {
  const { videos, clips, setScreen } = useEditorStore();
  const router = useRouter();

  useEffect(() => {
    // Set screen state for processing
    setScreen('processing');

    // Redirect to upload if no videos, or to edit if no clips
    if (videos.length === 0) {
      router.push('/');
    } else if (clips.length === 0) {
      router.push('/edit');
    }
  }, [videos.length, clips.length, router, setScreen]);

  // Don't render if no videos or clips
  if (videos.length === 0 || clips.length === 0) {
    return null;
  }

  return <ProcessingScreen />;
}