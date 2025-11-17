"""
LTP Async Worker Example (Python)

Demonstrates:
- Async/await patterns
- Worker pool pattern
- Message queue integration
- Concurrent operations
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Callable
from collections import deque
from dataclasses import dataclass

from ltp_client import LtpClient


@dataclass
class WorkerTask:
    """Task for worker to process"""
    task_id: str
    task_type: str
    payload: Dict[str, Any]
    callback: Optional[Callable] = None


class AsyncLtpWorker:
    """Async worker that processes tasks and sends via LTP"""

    def __init__(
        self,
        url: str,
        client_id: str,
        worker_id: str,
        max_concurrent: int = 5
    ):
        self.url = url
        self.client_id = client_id
        self.worker_id = worker_id
        self.max_concurrent = max_concurrent
        self.client: Optional[LtpClient] = None
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.workers: list = []
        self.running = False
        self.logger = logging.getLogger(f"ltp.worker.{worker_id}")

    async def start(self) -> None:
        """Start the worker pool"""
        self.client = LtpClient(self.url, client_id=self.client_id)
        await self.client.connect()
        
        self.running = True
        self.workers = [
            asyncio.create_task(self._worker_loop(f"worker-{i}"))
            for i in range(self.max_concurrent)
        ]
        
        self.logger.info(f"Started {self.max_concurrent} workers")

    async def stop(self) -> None:
        """Stop the worker pool"""
        self.running = False
        
        # Wait for queue to drain
        await self.task_queue.join()
        
        # Cancel workers
        for worker in self.workers:
            worker.cancel()
        
        await asyncio.gather(*self.workers, return_exceptions=True)
        
        if self.client:
            await self.client.disconnect()
        
        self.logger.info("Workers stopped")

    async def submit_task(
        self,
        task_type: str,
        payload: Dict[str, Any],
        callback: Optional[Callable] = None
    ) -> str:
        """Submit a task to the queue"""
        task_id = f"{self.worker_id}-{asyncio.get_event_loop().time()}"
        task = WorkerTask(
            task_id=task_id,
            task_type=task_type,
            payload=payload,
            callback=callback
        )
        
        await self.task_queue.put(task)
        self.logger.debug(f"Submitted task {task_id}")
        return task_id

    async def _worker_loop(self, worker_name: str) -> None:
        """Worker loop that processes tasks"""
        self.logger.info(f"Worker {worker_name} started")
        
        while self.running:
            try:
                # Get task with timeout
                task = await asyncio.wait_for(
                    self.task_queue.get(),
                    timeout=1.0
                )
                
                try:
                    await self._process_task(task)
                finally:
                    self.task_queue.task_done()
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                self.logger.error(
                    f"Error in worker {worker_name}",
                    extra={'error': str(e)}
                )

    async def _process_task(self, task: WorkerTask) -> None:
        """Process a single task"""
        self.logger.debug(
            f"Processing task {task.task_id}",
            extra={'type': task.task_type}
        )
        
        try:
            if task.task_type == 'state_update':
                await self.client.send_state_update(task.payload)
            elif task.task_type == 'event':
                await self.client.send_event(
                    task.payload.get('event_type'),
                    task.payload.get('data', {})
                )
            else:
                self.logger.warning(f"Unknown task type: {task.task_type}")
            
            # Call callback if provided
            if task.callback:
                await task.callback(task.task_id, True, None)
                
        except Exception as e:
            self.logger.error(
                f"Failed to process task {task.task_id}",
                extra={'error': str(e)}
            )
            
            if task.callback:
                await task.callback(task.task_id, False, str(e))


async def main():
    """Example usage"""
    worker = AsyncLtpWorker(
        url='ws://localhost:8080',
        client_id='async-worker-example',
        worker_id='worker-001',
        max_concurrent=3
    )

    try:
        await worker.start()

        # Submit multiple tasks concurrently
        tasks = []
        for i in range(10):
            task_id = await worker.submit_task(
                'state_update',
                {
                    'kind': 'test_update',
                    'data': {'index': i, 'timestamp': asyncio.get_event_loop().time()}
                }
            )
            tasks.append(task_id)
            await asyncio.sleep(0.1)  # Small delay between submissions

        print(f"Submitted {len(tasks)} tasks")

        # Wait for processing
        await asyncio.sleep(5)

        await worker.stop()
        print("Worker stopped")
    except Exception as e:
        print(f"Error: {e}")
        await worker.stop()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

