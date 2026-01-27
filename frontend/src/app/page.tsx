'use client';

import { useEditorStore } from '@/store/editorStore';
import UploadScreen from '@/components/UploadScreen';
import EditorScreen from '@/components/EditorScreen';
import ProcessingScreen from '@/components/ProcessingScreen';

export default function Home() {
  const { screen } = useEditorStore();

  return (
    <>
      {screen === 'upload' && <UploadScreen />}
      {screen === 'editor' && <EditorScreen />}
      {screen === 'processing' && <ProcessingScreen />}
    </>
  );
}
