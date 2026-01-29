'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editorStore';
import EditorScreen from '@/components/EditorScreen';

export default function EditPage() {
  const { videos, setScreen } = useEditorStore();
  const router = useRouter();

  useEffect(() => {
    // Set screen state for editor
    setScreen('editor');

    // Redirect to upload if no videos
    if (videos.length === 0) {
      router.push('/');
    }
  }, [videos.length, router, setScreen]);

  // Don't render if no videos
  if (videos.length === 0) {
    return null;
  }

  return <EditorScreen />;
}