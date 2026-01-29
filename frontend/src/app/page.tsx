'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editorStore';
import UploadScreen from '@/components/UploadScreen';

export default function Home() {
  const { videos, screen, setScreen } = useEditorStore();
  const router = useRouter();

  useEffect(() => {
    // Set screen state for upload
    setScreen('upload');

    // Redirect to edit if we have videos and are coming from somewhere else
    if (videos.length > 0 && screen === 'editor') {
      router.push('/edit');
    }
  }, [videos.length, screen, router, setScreen]);

  return <UploadScreen />;
}
