'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editorStore';
import { ExportSettings } from '@/types';
import { startExport, getJobStatus, cancelJob, getAllJobs, getJobStats } from '@/lib/api';

export default function ProcessingScreen() {
  const {
    clips,
    videos,
    audioTracks,
    exportSettings,
    jobs,
    addJob,
    updateJob,
    removeJob,
    addJobLog,
  } = useEditorStore();
  const router = useRouter();

  const [isExporting, setIsExporting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isRefreshingJobs, setIsRefreshingJobs] = useState(false);
  const [queueStats, setQueueStats] = useState<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedJob?.logs]);

  useEffect(() => {
    loadQueueStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadQueueStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStartExport = async () => {
    if (clips.length === 0) return;

    setIsExporting(true);

    // Create video URL map
    const videoUrls: Record<string, string> = {};
    videos.forEach((v) => {
      videoUrls[v.id] = v.url;
    });
    
    console.log('[ProcessingScreen] Videos:', videos.map(v => ({ id: v.id, url: v.url })));
    console.log('[ProcessingScreen] Clips:', clips.map(c => ({ id: c.id, videoId: c.videoId })));
    console.log('[ProcessingScreen] Video URLs map:', videoUrls);

    // Add job to queue
    const jobId = addJob(exportSettings);
    setSelectedJobId(jobId);

    addJobLog(jobId, 'Job created and added to queue');
    addJobLog(jobId, `Export settings: ${exportSettings.aspectRatio}, ${exportSettings.quality}, ${exportSettings.format}`);
    addJobLog(jobId, `Processing ${clips.length} clip(s)`);

    try {
      // Start export
      updateJob(jobId, { status: 'processing' });
      addJobLog(jobId, 'Starting video processing...');

      const response = await startExport(clips, audioTracks, exportSettings, videoUrls);
      addJobLog(jobId, `Backend job started: ${response.job_id}`);

      // Poll for status
      let lastLogCount = 0;
      const pollStatus = async () => {
        try {
          const status = await getJobStatus(response.job_id);
          updateJob(jobId, {
            progress: status.progress,
            status: status.status as 'pending' | 'processing' | 'completed' | 'failed',
          });

          // Add new logs from backend
          if (status.logs.length > lastLogCount) {
            for (let i = lastLogCount; i < status.logs.length; i++) {
              addJobLog(jobId, `[Backend] ${status.logs[i]}`);
            }
            lastLogCount = status.logs.length;
          }

          if (status.status === 'completed') {
            updateJob(jobId, {
              completedAt: new Date(),
              outputUrl: status.output_url,
            });
            addJobLog(jobId, 'Export completed successfully!');
            setIsExporting(false);
          } else if (status.status === 'failed') {
            addJobLog(jobId, 'Export failed');
            setIsExporting(false);
          } else {
            setTimeout(pollStatus, 1000);
          }
        } catch (err) {
          console.error('Status poll error:', err);
          setTimeout(pollStatus, 2000);
        }
      };

      pollStatus();
    } catch (err) {
      console.error('Export error:', err);
      addJobLog(jobId, 'Backend connection failed - running in demo mode');
      
      // Simulate processing for demo
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          updateJob(jobId, {
            status: 'completed',
            progress: 100,
            completedAt: new Date(),
          });
          addJobLog(jobId, 'Demo: Export completed (connect backend for real processing)');
          setIsExporting(false);
        } else {
          updateJob(jobId, { progress: Math.min(progress, 99) });
          addJobLog(jobId, `Demo: Processing... ${Math.round(progress)}%`);
        }
      }, 500);
    }
  };

  const handleDownload = (job: typeof selectedJob) => {
    if (job?.outputUrl) {
      // The outputUrl from backend already contains the full path like "/api/download/export_xxx.mp4"
      // We need to convert it to a full URL
      const fullUrl = job.outputUrl.startsWith('http')
        ? job.outputUrl
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${job.outputUrl}`;
      window.open(fullUrl, '_blank');
    } else {
      alert('Demo mode: Connect backend to download real exports');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      updateJob(jobId, { status: 'failed' });
      addJobLog(jobId, 'Job cancelled by user');
      if (selectedJobId === jobId) {
        // Refresh logs if this is the selected job
        setTimeout(() => {
          getJobStatus(jobId).then(status => {
            updateJob(jobId, {
              status: status.status as 'pending' | 'processing' | 'completed' | 'failed',
              progress: status.progress,
              logs: status.logs,
              outputUrl: status.output_url,
            });
          }).catch(console.error);
        }, 500);
      }
    } catch (error) {
      console.error('Failed to cancel job:', error);
      alert('Failed to cancel job');
    }
  };

  const loadQueueStats = async () => {
    try {
      const stats = await getJobStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const handleRefreshJobs = async () => {
    setIsRefreshingJobs(true);
    try {
      const [backendJobs, stats] = await Promise.all([
        getAllJobs(),
        getJobStats()
      ]);

      // Update local jobs with backend data
      backendJobs.forEach(backendJob => {
        const localJob = jobs.find(j => j.id === backendJob.id);
        if (localJob) {
          updateJob(backendJob.id, {
            status: backendJob.status as 'pending' | 'processing' | 'completed' | 'failed',
            progress: backendJob.progress,
            logs: backendJob.logs,
            outputUrl: backendJob.output_url,
          });
        }
      });

      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to refresh jobs:', error);
    } finally {
      setIsRefreshingJobs(false);
    }
  };

  const handleClearCompleted = () => {
    // Clear completed and failed jobs from local state
    // Note: Backend keeps them, but frontend can clear old jobs
    const jobsToRemove = jobs.filter(job => job.status === 'completed' || job.status === 'failed');
    jobsToRemove.forEach(job => removeJob(job.id));
  };

  const handleRetryJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'failed') return;

    // Reset job status and logs
    updateJob(jobId, {
      status: 'pending',
      progress: 0,
      logs: [...job.logs, `[${new Date().toISOString()}] Retrying failed job...`]
    });

    // Create video URL map
    const videoUrls: Record<string, string> = {};
    videos.forEach((v) => {
      videoUrls[v.id] = v.url;
    });

    try {
      // Start export again
      updateJob(jobId, { status: 'processing' });
      addJobLog(jobId, 'Starting retry processing...');

      const response = await startExport(clips, audioTracks, job.settings, videoUrls);
      addJobLog(jobId, `Backend retry job started: ${response.job_id}`);

      // Poll for status
      let lastLogCount = job.logs.length;
      const pollStatus = async () => {
        try {
          const status = await getJobStatus(response.job_id);
          updateJob(jobId, {
            progress: status.progress,
            status: status.status as 'pending' | 'processing' | 'completed' | 'failed',
          });

          // Add new logs from backend
          if (status.logs.length > lastLogCount) {
            for (let i = lastLogCount; i < status.logs.length; i++) {
              addJobLog(jobId, `[Backend] ${status.logs[i]}`);
            }
            lastLogCount = status.logs.length;
          }

          if (status.status === 'completed') {
            updateJob(jobId, {
              completedAt: new Date(),
              outputUrl: status.output_url,
            });
            addJobLog(jobId, 'Retry completed successfully!');
          } else if (status.status === 'failed') {
            addJobLog(jobId, 'Retry failed again');
          } else {
            setTimeout(pollStatus, 1000);
          }
        } catch (err) {
          console.error('Retry status poll error:', err);
          setTimeout(pollStatus, 2000);
        }
      };

      pollStatus();
    } catch (err) {
      console.error('Retry error:', err);
      addJobLog(jobId, 'Retry failed - backend connection error');
    }
  };

  const handleBatchExport = async (batchConfigs: Array<Partial<ExportSettings>>) => {
    if (clips.length === 0) return;

    setIsExporting(true);

    // Create video URL map
    const videoUrls: Record<string, string> = {};
    videos.forEach((v) => {
      videoUrls[v.id] = v.url;
    });

    console.log('[BatchExport] Videos:', videos.map(v => ({ id: v.id, url: v.url })));
    console.log('[BatchExport] Clips:', clips.map(c => ({ id: c.id, videoId: c.videoId })));
    console.log('[BatchExport] Video URLs map:', videoUrls);

    // Create jobs for each config
    for (const config of batchConfigs) {
      const settings = { ...exportSettings, ...config };
      const jobId = addJob(settings);
      setSelectedJobId(jobId);

      addJobLog(jobId, `Batch job created with settings: ${settings.aspectRatio}, ${settings.quality}, ${settings.format}`);
      addJobLog(jobId, `Processing ${clips.length} clip(s)`);

      try {
        // Start export
        updateJob(jobId, { status: 'processing' });
        addJobLog(jobId, 'Starting video processing...');

        const response = await startExport(clips, audioTracks, settings, videoUrls);
        addJobLog(jobId, `Backend job started: ${response.job_id}`);

        // Poll for status (in a real app, you'd want to manage multiple polls)
        // For simplicity, we'll just start all jobs and let them run
        addJobLog(jobId, 'Job queued for processing');

      } catch (err) {
        console.error('Batch export error:', err);
        addJobLog(jobId, 'Backend connection failed - job created but may not process');
      }
    }

    setIsExporting(false);
    // Refresh jobs after a short delay to show backend jobs
    setTimeout(handleRefreshJobs, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/edit')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Editor
            </button>
            <h1 className="text-2xl font-bold text-white">Export & Processing</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Export Controls */}
          <div className="space-y-6">
            {/* Export Summary */}
            <div className="bg-[#1a1a1a] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Export Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#2a2a2a] rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Clips</p>
                  <p className="text-2xl font-bold text-white">{clips.length}</p>
                </div>
                <div className="bg-[#2a2a2a] rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Audio Tracks</p>
                  <p className="text-2xl font-bold text-white">{audioTracks.length}</p>
                </div>
                <div className="bg-[#2a2a2a] rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Aspect Ratio</p>
                  <p className="text-2xl font-bold text-white">{exportSettings.aspectRatio}</p>
                </div>
                <div className="bg-[#2a2a2a] rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Quality</p>
                  <p className="text-2xl font-bold text-white capitalize">{exportSettings.quality}</p>
                </div>
              </div>

              <button
                onClick={handleStartExport}
                disabled={isExporting || clips.length === 0}
                className="w-full mt-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3"
              >
                {isExporting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Start Export
                  </>
                )}
              </button>
            </div>

            {/* Quick Batch Export */}
            <div className="bg-[#1a1a1a] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Quick Batch Export</h2>
              <p className="text-sm text-gray-400 mb-4">
                Export your project in multiple formats and qualities at once
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleBatchExport([
                      { quality: 'high', format: 'mp4' },
                      { quality: 'optimised', format: 'mp4' },
                      { quality: 'low', format: 'mp4' },
                    ])}
                    disabled={isExporting || clips.length === 0}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
                  >
                    All Qualities (MP4)
                  </button>
                  <button
                    onClick={() => handleBatchExport([
                      { aspectRatio: '16:9', quality: 'optimised', format: 'mp4' },
                      { aspectRatio: '9:16', quality: 'optimised', format: 'mp4' },
                      { aspectRatio: '1:1', quality: 'optimised', format: 'mp4' },
                    ])}
                    disabled={isExporting || clips.length === 0}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
                  >
                    All Ratios (HD)
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleBatchExport([{ quality: 'high', format: 'mp4' }])}
                    disabled={isExporting || clips.length === 0}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-xs transition-colors"
                  >
                    HD MP4
                  </button>
                  <button
                    onClick={() => handleBatchExport([{ quality: 'optimised', format: 'mp4' }])}
                    disabled={isExporting || clips.length === 0}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-xs transition-colors"
                  >
                    720p MP4
                  </button>
                  <button
                    onClick={() => handleBatchExport([{ quality: 'low', format: 'mp4' }])}
                    disabled={isExporting || clips.length === 0}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-xs transition-colors"
                  >
                    480p MP4
                  </button>
                </div>
              </div>
            </div>

            {/* Queue Statistics */}
            {queueStats && (
              <div className="bg-[#1a1a1a] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Queue Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{queueStats.processing}</div>
                    <div className="text-sm text-gray-400">Processing</div>
                  </div>
                  <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-400">{queueStats.pending}</div>
                    <div className="text-sm text-gray-400">Queued</div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{queueStats.completed}</div>
                    <div className="text-sm text-gray-400">Completed</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-400">{queueStats.failed}</div>
                    <div className="text-sm text-gray-400">Failed</div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-sm text-gray-500">
                    Total Jobs: <span className="text-white font-medium">{queueStats.total}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Job Queue */}
            <div className="bg-[#1a1a1a] rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Job Queue</h2>
                <div className="flex items-center gap-2">
                  {jobs.some(job => job.status === 'completed' || job.status === 'failed') && (
                    <button
                      onClick={handleClearCompleted}
                      className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded transition-colors"
                      title="Clear completed and failed jobs"
                    >
                      Clear Done
                    </button>
                  )}
                  <button
                    onClick={handleRefreshJobs}
                    disabled={isRefreshingJobs}
                    className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Refresh jobs from backend"
                  >
                    <svg className={`w-4 h-4 ${isRefreshingJobs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {jobs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p>No jobs yet</p>
                  <p className="text-xs mt-1">Create an export to add jobs to the queue</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {jobs
                    .sort((a, b) => {
                      // Sort by status priority: processing > pending > completed > failed
                      const statusOrder = { processing: 0, pending: 1, completed: 2, failed: 3 };
                      const aOrder = statusOrder[a.status];
                      const bOrder = statusOrder[b.status];
                      if (aOrder !== bOrder) return aOrder - bOrder;
                      // Then by creation time (newest first)
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map((job, index) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedJobId === job.id
                          ? 'bg-blue-500/20 border border-blue-500'
                          : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-white font-medium text-sm">
                              Export #{job.id.slice(0, 8)}
                            </p>
                            {index === 0 && job.status === 'processing' && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                Processing
                              </span>
                            )}
                            {index > 0 && job.status === 'pending' && (
                              <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded">
                                Queue #{index}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              job.status === 'completed'
                                ? 'bg-green-500/20 text-green-400'
                                : job.status === 'processing'
                                ? 'bg-blue-500/20 text-blue-400'
                                : job.status === 'failed'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {job.status}
                          </span>
                          {job.status === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelJob(job.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                              title="Cancel job"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          {job.status === 'failed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryJob(job.id);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Retry job"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {job.status === 'processing' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(job.progress)}%</span>
                          </div>
                          <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {job.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(job);
                          }}
                          className="mt-2 w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Logs */}
          <div className="bg-[#1a1a1a] rounded-xl p-6 flex flex-col h-[600px]">
            <h2 className="text-lg font-semibold text-white mb-4">Processing Logs</h2>
            
            {selectedJob ? (
              <div className="flex-1 bg-[#0a0a0a] rounded-lg p-4 overflow-y-auto font-mono text-sm">
                {selectedJob.logs.length === 0 ? (
                  <p className="text-gray-500">No logs yet...</p>
                ) : (
                  <div className="space-y-1">
                    {selectedJob.logs.map((log, index) => (
                      <div
                        key={index}
                        className={`${
                          log.includes('error') || log.includes('failed')
                            ? 'text-red-400'
                            : log.includes('completed') || log.includes('success')
                            ? 'text-green-400'
                            : log.includes('Processing') || log.includes('Starting')
                            ? 'text-blue-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Select a job to view logs</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
