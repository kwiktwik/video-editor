import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Callable
from collections import deque
import threading

from .models import Job, JobStatus, ExportRequest


class JobQueue:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}
        self.queue: deque = deque()
        self.current_job_id: Optional[str] = None
        self.is_processing = False
        self._lock = threading.Lock()
        self._callbacks: Dict[str, Dict[str, Callable]] = {}

    def create_job(self, request: ExportRequest) -> Job:
        """Create a new job and add it to the queue"""
        job_id = uuid.uuid4().hex[:12]
        job = Job(
            id=job_id,
            status=JobStatus.PENDING,
            progress=0,
            logs=[],
            created_at=datetime.now(),
            request=request,
        )
        
        with self._lock:
            self.jobs[job_id] = job
            self.queue.append(job_id)
        
        self.add_log(job_id, "Job created and added to queue")
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        return self.jobs.get(job_id)

    def get_all_jobs(self) -> List[Job]:
        """Get all jobs sorted by status and creation time"""
        # Sort by status priority: processing > pending > completed > failed
        status_order = {'processing': 0, 'pending': 1, 'completed': 2, 'failed': 3}
        return sorted(
            self.jobs.values(),
            key=lambda job: (status_order.get(job.status.value, 4), job.created_at)
        )

    def update_job(self, job_id: str, **kwargs):
        """Update job properties"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job:
                for key, value in kwargs.items():
                    if hasattr(job, key):
                        setattr(job, key, value)

    def add_log(self, job_id: str, log: str):
        """Add a log entry to a job"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job:
                timestamp = datetime.now().strftime("%H:%M:%S")
                job.logs.append(f"[{timestamp}] {log}")

    def set_progress(self, job_id: str, progress: float):
        """Update job progress"""
        self.update_job(job_id, progress=min(progress, 100))

    def get_next_job(self) -> Optional[Job]:
        """Get the next pending job from queue"""
        with self._lock:
            print(f"[JobQueue] Queue length: {len(self.queue)}, Jobs: {list(self.jobs.keys())}")
            while self.queue:
                job_id = self.queue.popleft()
                job = self.jobs.get(job_id)
                print(f"[JobQueue] Checking job {job_id}, status: {job.status if job else 'NOT FOUND'}")
                if job and job.status == JobStatus.PENDING:
                    print(f"[JobQueue] Returning pending job: {job_id}")
                    return job
            print("[JobQueue] No pending jobs found")
        return None

    def complete_job(self, job_id: str, output_url: str):
        """Mark job as completed"""
        self.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            completed_at=datetime.now(),
            output_url=output_url,
        )
        self.add_log(job_id, "Job completed successfully")

    def fail_job(self, job_id: str, error: str):
        """Mark job as failed"""
        self.update_job(
            job_id,
            status=JobStatus.FAILED,
            completed_at=datetime.now(),
        )
        self.add_log(job_id, f"Job failed: {error}")

    def cancel_job(self, job_id: str):
        """Cancel a pending job"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job and job.status == JobStatus.PENDING:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.now()
                self.add_log(job_id, "Job cancelled by user")
                # Remove from queue if present
                try:
                    self.queue.remove(job_id)
                except ValueError:
                    pass

    def register_callbacks(self, job_id: str, log_callback: Callable, progress_callback: Callable):
        """Register callbacks for a job"""
        self._callbacks[job_id] = {
            "log": log_callback,
            "progress": progress_callback,
        }

    def get_callbacks(self, job_id: str) -> Optional[Dict[str, Callable]]:
        """Get callbacks for a job"""
        return self._callbacks.get(job_id)

    def clear_callbacks(self, job_id: str):
        """Clear callbacks for a job"""
        if job_id in self._callbacks:
            del self._callbacks[job_id]

    def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        stats = {
            'pending': 0,
            'processing': 0,
            'completed': 0,
            'failed': 0,
            'total': len(self.jobs)
        }
        for job in self.jobs.values():
            stats[job.status.value] += 1
        return stats


# Global job queue instance
job_queue = JobQueue()


def get_job_queue() -> JobQueue:
    return job_queue
