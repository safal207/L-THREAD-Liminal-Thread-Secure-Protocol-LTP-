defmodule LTP.Crypto do
  @moduledoc """
  Cryptographic helpers for the LTP Elixir client.
  
  Provides ECDH key exchange, authenticated ECDH, HMAC-based nonces,
  metadata encryption, and hash chaining functions for v0.6.0 security features.
  """

  @doc """
  Compute HMAC-SHA256 for any string input.
  
  Used for secure nonce generation and other HMAC operations.
  """
  @spec hmac_sha256(String.t(), String.t()) :: String.t()
  def hmac_sha256(input, key) do
    :crypto.mac(:hmac, :sha256, key, input)
    |> Base.encode16(case: :lower)
  end

  @doc """
  Generate ECDH key pair for key exchange.
  
  Returns tuple of {public_key_hex, private_key_hex} using secp256r1 (P-256) curve.
  """
  @spec generate_ecdh_key_pair() :: {String.t(), String.t()}
  def generate_ecdh_key_pair do
    # Generate key pair using :crypto.generate_key/3
    # :ecdh - algorithm
    # :secp256r1 - curve (P-256)
    # [] - options
    {public_key, private_key} = :crypto.generate_key(:ecdh, :secp256r1, [])
    
    # Convert to hex strings
    public_key_hex = Base.encode16(public_key, case: :lower)
    private_key_hex = Base.encode16(private_key, case: :lower)
    
    {public_key_hex, private_key_hex}
  end

  @doc """
  Derive shared secret from ECDH key exchange.
  
  Args:
    - private_key_hex: Hex-encoded private key
    - peer_public_key_hex: Hex-encoded peer public key (uncompressed point)
  
  Returns:
    Hex-encoded shared secret (32 bytes)
  """
  @spec derive_shared_secret(String.t(), String.t()) :: String.t()
  def derive_shared_secret(private_key_hex, peer_public_key_hex) do
    private_key = Base.decode16!(private_key_hex, case: :lower)
    peer_public_key = Base.decode16!(peer_public_key_hex, case: :lower)
    
    # Compute shared secret using :crypto.compute_key/4
    # :ecdh - algorithm
    # peer_public_key - other party's public key
    # private_key - our private key
    # :secp256r1 - curve
    shared_secret = :crypto.compute_key(:ecdh, peer_public_key, private_key, :secp256r1)
    
    Base.encode16(shared_secret, case: :lower)
  end

  @doc """
  HKDF (HMAC-based Key Derivation Function) - RFC 5869.
  
  Derives multiple keys from shared secret with proper key separation.
  
  Args:
    - shared_secret_hex: Hex-encoded shared secret
    - salt: Salt string
    - info: Info string for key separation
    - key_length: Desired key length in bytes (default: 32)
  
  Returns:
    Hex-encoded derived key
  """
  @spec hkdf(String.t(), String.t(), String.t(), non_neg_integer()) :: String.t()
  def hkdf(shared_secret_hex, salt, info, key_length \\ 32) do
    shared_secret = Base.decode16!(shared_secret_hex, case: :lower)
    salt_bytes = if salt, do: salt, else: <<0::256>>
    
    # HKDF-Extract: PRK = HMAC-SHA256(salt, shared_secret)
    prk = :crypto.mac(:hmac, :sha256, salt_bytes, shared_secret)
    
    # HKDF-Expand: OKM = HMAC-SHA256(PRK, info || 0x01 || 0x00...)
    # Simplified single-step expansion for key_length <= 32 bytes
    info_bytes = info <> <<1>>
    okm = :crypto.mac(:hmac, :sha256, prk, info_bytes)
    
    # Truncate to desired length
    <<derived_key::binary-size(key_length), _::binary>> = okm
    
    Base.encode16(derived_key, case: :lower)
  end

  @doc """
  Derive session keys from ECDH shared secret using HKDF.
  
  Returns separate keys for encryption, MAC, and IV.
  
  Args:
    - shared_secret_hex: Hex-encoded shared secret from ECDH
    - session_id: Session identifier for key separation
  
  Returns:
    Tuple of {encryption_key_hex, mac_key_hex, iv_key_hex}
  """
  @spec derive_session_keys(String.t(), String.t()) :: {String.t(), String.t(), String.t()}
  def derive_session_keys(shared_secret_hex, session_id) do
    salt = "ltp-v0.5-#{session_id}"
    
    encryption_key = hkdf(shared_secret_hex, salt, "ltp-encryption-key", 32)
    mac_key = hkdf(shared_secret_hex, salt, "ltp-mac-key", 32)
    iv_key = hkdf(shared_secret_hex, salt, "ltp-iv-key", 16)
    
    {encryption_key, mac_key, iv_key}
  end

  @doc """
  Sign an ECDH public key to prevent MitM attacks (v0.6+).
  
  Creates HMAC signature over: publicKey + entityId + timestamp
  This authenticates the ephemeral ECDH key exchange.
  
  Args:
    - public_key: Hex-encoded ECDH public key
    - entity_id: client_id (for client) or session_id (for server)
    - timestamp: Unix timestamp in milliseconds
    - secret_key: Long-term secret key for signing
  
  Returns:
    Hex-encoded HMAC-SHA256 signature
  """
  @spec sign_ecdh_public_key(String.t(), String.t(), integer(), String.t()) :: String.t()
  def sign_ecdh_public_key(public_key, entity_id, timestamp, secret_key) do
    input = "#{public_key}:#{entity_id}:#{timestamp}"
    hmac_sha256(input, secret_key)
  end

  @doc """
  Verify ECDH public key signature (v0.6+).
  
  Validates that the ephemeral ECDH public key was signed by the expected party.
  Prevents MitM attacks on key exchange.
  
  Args:
    - public_key: Hex-encoded ECDH public key
    - entity_id: client_id (for client) or session_id (for server)
    - timestamp: Unix timestamp in milliseconds
    - signature: Hex-encoded HMAC-SHA256 signature to verify
    - secret_key: Long-term secret key for verification
    - max_age_ms: Maximum age of signature in milliseconds (default: 300000 = 5 minutes)
  
  Returns:
    {:ok, nil} if valid, {:error, reason} if invalid
  """
  @spec verify_ecdh_public_key(String.t(), String.t(), integer(), String.t(), String.t(), integer()) :: {:ok, nil} | {:error, String.t()}
  def verify_ecdh_public_key(public_key, entity_id, timestamp, signature, secret_key, max_age_ms \\ 300_000) do
    # Check timestamp freshness
    now = System.system_time(:millisecond)
    timestamp_ms = if timestamp < 1_000_000_000_000, do: timestamp * 1000, else: timestamp
    age = now - timestamp_ms
    unit_hint = if timestamp < 1_000_000_000_000, do: " (timestamp looks like seconds; expected milliseconds)", else: ""
    
    cond do
      age > max_age_ms ->
        {:error, "ECDH key signature expired (age: #{age}ms, max: #{max_age_ms}ms)#{unit_hint}"}
      
      age < -5000 ->
        {:error, "ECDH key signature from future (skew: #{-age}ms)#{unit_hint}"}
      
      true ->
        # Compute expected signature
        input = "#{public_key}:#{entity_id}:#{timestamp}"
        expected_signature = hmac_sha256(input, secret_key)
        
        # Constant-time comparison
        if timing_safe_equal(signature, expected_signature) do
          {:ok, nil}
        else
          {:error, "ECDH key signature mismatch"}
        end
    end
  end

  @doc """
  Generate a deterministic SHA-256 hash commitment for a canonical envelope.
  
  Args:
    - message: Message envelope map
  
  Returns:
    Hex-encoded SHA-256 hash
  """
  @spec hash_envelope(map()) :: String.t()
  def hash_envelope(message) do
    # Canonicalize message for hashing
    canonical = canonicalize_message(message)
    serialized = Jason.encode!(canonical)
    
    :crypto.hash(:sha256, serialized)
    |> Base.encode16(case: :lower)
  end

  @doc """
  Encrypt sensitive metadata fields to prevent tracking (v0.6+).
  
  Encrypts thread_id, session_id, and timestamp using AES-256-GCM.
  This prevents adversaries from tracking users across sessions.
  
  Args:
    - metadata: Map containing thread_id, session_id, timestamp
    - encryption_key_hex: Hex-encoded 256-bit encryption key (from HKDF)
  
  Returns:
    Encrypted metadata blob (ciphertext:iv:tag format)
  """
  @spec encrypt_metadata(map(), String.t()) :: String.t()
  def encrypt_metadata(metadata, encryption_key_hex) do
    # Serialize metadata to JSON
    metadata_json = Jason.encode!(metadata)
    
    # Decode encryption key
    encryption_key = Base.decode16!(encryption_key_hex, case: :lower)
    
    # Generate random IV (12 bytes for GCM)
    iv = :crypto.strong_rand_bytes(12)
    
    # Encrypt using AES-256-GCM
    # :aes_256_gcm - algorithm
    # encryption_key - 32-byte key
    # iv - 12-byte IV
    # metadata_json - plaintext
    # <<>> - additional authenticated data (AAD)
    {ciphertext, tag} = :crypto.crypto_one_time_aead(:aes_256_gcm, encryption_key, iv, metadata_json, <<>>, true)
    
    # Format: ciphertext:iv:tag (colon-separated for easy parsing)
    ciphertext_hex = Base.encode16(ciphertext, case: :lower)
    iv_hex = Base.encode16(iv, case: :lower)
    tag_hex = Base.encode16(tag, case: :lower)
    
    "#{ciphertext_hex}:#{iv_hex}:#{tag_hex}"
  end

  @doc """
  Decrypt metadata fields (v0.6+).
  
  Args:
    - encrypted_metadata: Encrypted metadata blob (ciphertext:iv:tag format)
    - encryption_key_hex: Hex-encoded 256-bit encryption key
  
  Returns:
    {:ok, decrypted_metadata_map} or {:error, reason}
  """
  @spec decrypt_metadata(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def decrypt_metadata(encrypted_metadata, encryption_key_hex) do
    # Parse format: ciphertext:iv:tag
    case String.split(encrypted_metadata, ":") do
      [ciphertext_hex, iv_hex, tag_hex] when ciphertext_hex != "" and iv_hex != "" and tag_hex != "" ->
        try do
          ciphertext = Base.decode16!(ciphertext_hex, case: :lower)
          iv = Base.decode16!(iv_hex, case: :lower)
          tag = Base.decode16!(tag_hex, case: :lower)
          encryption_key = Base.decode16!(encryption_key_hex, case: :lower)
          
          # Decrypt using AES-256-GCM
          case :crypto.crypto_one_time_aead(:aes_256_gcm, encryption_key, iv, ciphertext, <<>>, tag, false) do
            :error ->
              {:error, "Decryption failed - authentication tag mismatch"}
            
            plaintext ->
              # Parse JSON back to metadata map
              case Jason.decode(plaintext) do
                {:ok, metadata} ->
                  # Validate structure
                  if Map.has_key?(metadata, "thread_id") and Map.has_key?(metadata, "session_id") and Map.has_key?(metadata, "timestamp") do
                    {:ok, metadata}
                  else
                    {:error, "Invalid decrypted metadata structure"}
                  end
                
                {:error, _} = error ->
                  error
              end
          end
        rescue
          ArgumentError ->
            {:error, "Invalid encrypted metadata format - hex decode failed"}
        end
      
      _ ->
        {:error, "Invalid encrypted metadata format - expected ciphertext:iv:tag"}
    end
  end

  @doc """
  Generate routing tag for server-side message routing (v0.6+).
  
  Creates HMAC-based tag that doesn't reveal thread_id or session_id.
  Server can use this for routing without seeing plaintext metadata.
  
  Args:
    - thread_id: Thread identifier
    - session_id: Session identifier
    - mac_key_hex: Hex-encoded MAC key (from HKDF)
  
  Returns:
    Routing tag (first 32 hex characters of HMAC)
  """
  @spec generate_routing_tag(String.t(), String.t(), String.t()) :: String.t()
  def generate_routing_tag(thread_id, session_id, mac_key_hex) do
    input = "#{thread_id}:#{session_id}"
    mac_key = Base.decode16!(mac_key_hex, case: :lower)
    
    hmac_result = :crypto.mac(:hmac, :sha256, mac_key, input)
    |> Base.encode16(case: :lower)
    
    # Return first 32 hex characters (16 bytes) for routing tag
    String.slice(hmac_result, 0, 32)
  end

  @doc """
  Sign a message using HMAC-SHA256.
  
  Args:
    - message: Message map
    - secret_key: Secret key for signing
  
  Returns:
    Hex-encoded HMAC-SHA256 signature
  """
  @spec sign_message(map(), String.t()) :: String.t()
  def sign_message(message, secret_key) do
    canonical = canonicalize_message(message)
    serialized = Jason.encode!(canonical)
    
    :crypto.mac(:hmac, :sha256, secret_key, serialized)
    |> Base.encode16(case: :lower)
  end

  @doc """
  Verify message signature using constant-time comparison.
  
  Args:
    - message: Message map with signature field
    - secret_key: Secret key for verification
  
  Returns:
    true if signature is valid, false otherwise
  """
  @spec verify_signature(map(), String.t()) :: boolean()
  def verify_signature(message, secret_key) do
    provided_signature = Map.get(message, "signature") || Map.get(message, :signature)
    
    if is_nil(provided_signature) or not is_binary(provided_signature) do
      false
    else
      expected_signature = sign_message(message, secret_key)
      timing_safe_equal(provided_signature, expected_signature)
    end
  end

  # Private helpers

  defp timing_safe_equal(a, b) when byte_size(a) == byte_size(b) do
    import Bitwise

    a_bytes = :binary.bin_to_list(a)
    b_bytes = :binary.bin_to_list(b)

    diff =
      Enum.reduce(Enum.zip(a_bytes, b_bytes), 0, fn {x, y}, acc ->
        acc ||| bxor(x, y)
      end)

    diff == 0
  end

  defp timing_safe_equal(_a, _b), do: false

  defp canonicalize_message(message) do
    # Extract canonical fields used for signing/verification
    %{
      "type" => get_field(message, "type") || get_field(message, :type) || "",
      "thread_id" => get_field(message, "thread_id") || get_field(message, :thread_id) || "",
      "session_id" => get_field(message, "session_id") || get_field(message, :session_id) || "",
      "timestamp" => get_field(message, "timestamp") || get_field(message, :timestamp) || 0,
      "nonce" => get_field(message, "nonce") || get_field(message, :nonce) || "",
      "payload" => get_field(message, "payload") || get_field(message, :payload) || %{},
      "meta" => get_field(message, "meta") || get_field(message, :meta) || %{},
      "content_encoding" => get_field(message, "content_encoding") || get_field(message, :content_encoding) || ""
    }
  end

  defp get_field(map, key) when is_atom(key) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  defp get_field(map, key) when is_binary(key) do
    Map.get(map, key) || Map.get(map, String.to_existing_atom(key))
  rescue
    ArgumentError -> nil
  end
end

