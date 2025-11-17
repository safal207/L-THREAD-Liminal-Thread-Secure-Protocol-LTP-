"""
LTP Production-Ready Client Example (Python)

Demonstrates:
- Robust error handling and reconnection
- Structured logging
- Metrics collection
- Graceful shutdown
- Batch operations
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

from ltp_client import LtpClient, ThreadStorage


@dataclass
class ClientMetrics:
    """Metrics collection for production monitoring"""
    messages_sent: int = 0
    messages_received: int = 0
    errors: int = 0
    reconnects: int = 0
    start_time: float = field(default_factory=time.time)
    last_connect_time: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        uptime = time.time() - self.start_time
        return {
            'messages_sent': self.messages_sent,
            'messages_received': self.messages_received,
            'errors': self.errors,
            'reconnects': self.reconnects,
            'uptime_seconds': int(uptime),
            'messages_per_second': self.messages_sent / uptime if uptime > 0 else 0,
        }


class ProductionLtpClient:
    """Production-ready LTP client with monitoring and error handling"""

    def __init__(
        self,
        url: str,
        client_id: Optional[str] = None,
        logger: Optional[logging.Logger] = None,
        **client_options
    ):
        self.url = url
        self.client_id = client_id or f"prod-client-{int(time.time())}"
        self.metrics = ClientMetrics()
        self.logger = logger or self._setup_default_logger()
        self.client: Optional[LtpClient] = None
        self.client_options = client_options

    def _setup_default_logger(self) -> logging.Logger:
        """Setup default structured logger"""
        logger = logging.getLogger(f"ltp.{self.client_id}")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger

    async def connect(self) -> None:
        """Connect to LTP server with error handling"""
        try:
            self.client = LtpClient(
                self.url,
                client_id=self.client_id,
                **self.client_options
            )
            
            # Set up event handlers
            self.client.on_error = self._handle_error
            self.client.on_state_update = self._handle_state_update
            self.client.on_event = self._handle_event
            
            await self.client.connect()
            self.metrics.last_connect_time = time.time()
            self.logger.info(
                "Connected to LTP server",
                extra={
                    'client_id': self.client_id,
                    'thread_id': self.client.thread_id,
                    'session_id': self.client.session_id,
                }
            )
        except Exception as e:
            self.metrics.errors += 1
            self.logger.error(
                "Failed to connect to LTP server",
                extra={'error': str(e), 'url': self.url}
            )
            raise

    async def send_batch_state_updates(
        self,
        updates: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Send multiple state updates in batch"""
        if not updates:
            raise ValueError("Updates list cannot be empty")

        self.logger.debug(f"Sending batch of {len(updates)} state updates")
        results = []

        for update in updates:
            try:
                await self.client.send_state_update(update)
                self.metrics.messages_sent += 1
                results.append({'success': True, 'update': update})
            except Exception as e:
                self.metrics.errors += 1
                results.append({
                    'success': False,
                    'update': update,
                    'error': str(e)
                })
                self.logger.error(
                    "Failed to send state update",
                    extra={'error': str(e), 'update': update}
                )

        return results

    async def send_affect_log_batch(
        self,
        affect_logs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Send a large batch of affect logs (optimized for TOON in future)"""
        self.logger.info(f"Sending affect log batch ({len(affect_logs)} entries)")
        
        try:
            await self.client.send_state_update({
                'kind': 'affect_log_batch',
                'data': affect_logs,
            })
            self.metrics.messages_sent += 1
            return {'success': True}
        except Exception as e:
            self.metrics.errors += 1
            self.logger.error(
                "Failed to send affect log batch",
                extra={'error': str(e)}
            )
            return {'success': False, 'error': str(e)}

    def _handle_error(self, error_payload: Dict[str, Any]) -> None:
        """Handle error messages from server"""
        self.metrics.errors += 1
        self.logger.error(
            "LTP error received",
            extra={
                'error_code': error_payload.get('error_code'),
                'error_message': error_payload.get('error_message'),
                'details': error_payload.get('details'),
            }
        )

    def _handle_state_update(self, payload: Dict[str, Any]) -> None:
        """Handle state update messages"""
        self.metrics.messages_received += 1
        self.logger.debug(
            "Received state update",
            extra={'kind': payload.get('kind')}
        )
        
        # Process affect logs if present
        if payload.get('kind') == 'affect_log_batch':
            self._process_affect_logs(payload.get('data', []))

    def _handle_event(self, payload: Dict[str, Any]) -> None:
        """Handle event messages"""
        self.metrics.messages_received += 1
        self.logger.debug(
            "Received event",
            extra={'event_type': payload.get('event_type')}
        )

    def _process_affect_logs(self, data: List[Dict[str, Any]]) -> None:
        """Process affect log data"""
        if not data:
            return
        
        self.logger.info(f"Processing {len(data)} affect log entries")
        
        # Calculate average valence if available
        if data and 'valence' in data[0]:
            avg_valence = sum(log.get('valence', 0) for log in data) / len(data)
            self.logger.info(
                "Average valence calculated",
                extra={'avg_valence': avg_valence}
            )

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        return self.metrics.to_dict()

    async def disconnect(self) -> None:
        """Gracefully disconnect"""
        self.logger.info("Disconnecting production client")
        metrics = self.get_metrics()
        self.logger.info("Final metrics", extra=metrics)
        
        if self.client:
            await self.client.disconnect()


async def main():
    """Example usage"""
    client = ProductionLtpClient(
        'ws://localhost:8080',
        client_id='prod-example-python-001',
    )

    try:
        await client.connect()

        # Send a large batch of affect logs
        affect_logs = [
            {
                't': i + 1,
                'valence': 0.5 * (1 + (i % 10) / 10),
                'arousal': 0.3 * (1 - (i % 10) / 10),
                'timestamp': int(time.time()) + i,
            }
            for i in range(100)
        ]

        result = await client.send_affect_log_batch(affect_logs)
        print(f"Affect log batch result: {result}")

        # Send multiple state updates
        updates = [
            {'kind': 'system_status', 'data': {'cpu': 0.5, 'memory': 0.7}},
            {'kind': 'user_activity', 'data': {'action': 'login', 'userId': 'user123'}},
            {'kind': 'performance_metric', 'data': {'latency': 120, 'throughput': 1000}},
        ]

        results = await client.send_batch_state_updates(updates)
        print(f"Batch updates: {len([r for r in results if r['success']])}/{len(results)} successful")

        # Wait and show metrics
        await asyncio.sleep(2)
        
        metrics = client.get_metrics()
        print("\n=== Production Client Metrics ===")
        for key, value in metrics.items():
            print(f"{key}: {value}")

        await client.disconnect()
    except Exception as e:
        print(f"Fatal error: {e}")
        raise


if __name__ == '__main__':
    asyncio.run(main())

