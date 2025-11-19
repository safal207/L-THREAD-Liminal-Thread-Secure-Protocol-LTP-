defmodule LTP.Types do
  @moduledoc """
  Type definitions for LTP (Liminal Thread Protocol) messages and structures.
  """

  @type content_encoding :: :json | :toon

  @type handshake_init :: %{
          type: String.t(),
          ltp_version: String.t(),
          client_id: String.t(),
          device_fingerprint: String.t() | nil,
          intent: String.t() | nil,
          capabilities: list(String.t()) | nil,
          metadata: map() | nil,
          client_public_key: String.t() | nil,  # Legacy field name
          client_ecdh_public_key: String.t() | nil,  # v0.6+ explicit name
          client_ecdh_signature: String.t() | nil,  # v0.6+ authenticated ECDH
          client_ecdh_timestamp: integer() | nil,  # v0.6+ authenticated ECDH
          key_agreement: map() | nil
        }

  @type handshake_resume :: %{
          type: String.t(),
          ltp_version: String.t(),
          client_id: String.t(),
          thread_id: String.t(),
          resume_reason: String.t()
        }

  @type handshake_ack :: %{
          type: String.t(),
          ltp_version: String.t(),
          thread_id: String.t(),
          session_id: String.t(),
          resumed: boolean(),
          server_capabilities: list(String.t()) | nil,
          heartbeat_interval_ms: non_neg_integer(),
          metadata: map() | nil,
          server_public_key: String.t() | nil,  # Legacy field name
          server_ecdh_public_key: String.t() | nil,  # v0.6+ explicit name
          server_ecdh_signature: String.t() | nil,  # v0.6+ authenticated ECDH
          server_ecdh_timestamp: integer() | nil,  # v0.6+ authenticated ECDH
          key_agreement: map() | nil
        }

  @type handshake_reject :: %{
          type: String.t(),
          ltp_version: String.t(),
          reason: String.t(),
          suggest_new: boolean()
        }

  @type ltp_envelope :: %{
          type: String.t(),
          thread_id: String.t(),
          session_id: String.t() | nil,
          timestamp: integer(),
          content_encoding: content_encoding(),
          payload: map(),
          meta: map() | nil,
          nonce: String.t() | nil,
          signature: String.t() | nil,
          prev_message_hash: String.t() | nil,  # v0.5+ hash chaining
          encrypted_metadata: String.t() | nil,  # v0.6+ metadata encryption
          routing_tag: String.t() | nil  # v0.6+ routing tag for encrypted metadata
        }

  @type state_update_payload :: %{
          kind: String.t(),
          data: term()
        }

  @type event_payload :: %{
          event_type: String.t(),
          data: map()
        }

  @type ping_payload :: %{}

  @type pong_payload :: %{}

  @type error_payload :: %{
          error_code: String.t(),
          error_message: String.t(),
          details: map() | nil
        }

  @type ltp_message ::
          handshake_init()
          | handshake_resume()
          | handshake_ack()
          | handshake_reject()
          | ltp_envelope()
end

