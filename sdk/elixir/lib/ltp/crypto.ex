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
    salt_bytes = if salt && salt != "", do: salt, else: <<0::256>>
    info_bytes = if info, do: info, else: <<>>

    # HKDF-Extract: PRK = HMAC-SHA256(salt, shared_secret)
    prk = :crypto.mac(:hmac, :sha256, salt_bytes, shared_secret)

    # HKDF-Expand per RFC 5869: T(i) = HMAC(PRK, T(i-1) || info || i)
    hash_len = 32
    n = div(key_length + hash_len - 1, hash_len)

    if n > 255 do
      raise ArgumentError, "HKDF key_length too large (max 255 * 32 bytes)"
    end

    okm =
      Enum.reduce(1..n, {<<>>, <<>>}, fn i, {prev_t, acc} ->
        t = :crypto.mac(:hmac, :sha256, prk, prev_t <> info_bytes <> <<i>>)
        {t, acc <> t}
      end)
      |> elem(1)

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
  Generate a deterministic SHA-256 hash commitment for Canonical Envelope v1.
  """
  @spec hash_envelope(map()) :: String.t()
  def hash_envelope(message) do
    message
    |> serialize_canonical()
    |> then(&:crypto.hash(:sha256, &1))
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

  @doc "Sign a message using HMAC-SHA256 over Canonical Envelope v1 bytes."
  @spec sign_message(map(), String.t()) :: String.t()
  def sign_message(message, secret_key) do
    :crypto.mac(:hmac, :sha256, secret_key, serialize_canonical(message))
    |> Base.encode16(case: :lower)
  end

  @doc "Verify a message signature using a constant-time comparison."
  @spec verify_signature(map(), String.t()) :: boolean()
  def verify_signature(message, secret_key) do
    provided_signature = Map.get(message, "signature") || Map.get(message, :signature)

    if is_binary(provided_signature) do
      timing_safe_equal(provided_signature, sign_message(message, secret_key))
    else
      false
    end
  end

  @doc "Serialize the protocol signing fields using RFC 8785/JCS-compatible rules."
  @spec serialize_canonical(map()) :: String.t()
  def serialize_canonical(message) do
    %{
      "type" => get_field(message, "type") || "",
      "thread_id" => get_field(message, "thread_id") || "",
      "session_id" => get_field(message, "session_id") || "",
      "timestamp" => get_field(message, "timestamp") || 0,
      "nonce" => get_field(message, "nonce") || "",
      "payload" => get_field(message, "payload") || %{},
      "prev_message_hash" => get_field(message, "prev_message_hash") || "",
      "meta" => get_field(message, "meta") || %{},
      "content_encoding" => get_field(message, "content_encoding") || ""
    }
    |> encode_canonical_value()
  end

  # Private helpers

  defp timing_safe_equal(a, b) when byte_size(a) == byte_size(b) do
    import Bitwise

    Enum.zip(:binary.bin_to_list(a), :binary.bin_to_list(b))
    |> Enum.reduce(0, fn {x, y}, acc -> acc ||| bxor(x, y) end)
    |> Kernel.==(0)
  end

  defp timing_safe_equal(_a, _b), do: false

  defp encode_canonical_value(nil), do: "null"
  defp encode_canonical_value(true), do: "true"
  defp encode_canonical_value(false), do: "false"
  defp encode_canonical_value(value) when is_binary(value), do: Jason.encode!(value)

  defp encode_canonical_value(value) when is_integer(value) do
    if abs(value) > 9_007_199_254_740_991 do
      raise ArgumentError, "Canonical Envelope v1 rejects unsafe integer"
    end

    Integer.to_string(value)
  end

  defp encode_canonical_value(value) when is_float(value), do: serialize_float(value)

  defp encode_canonical_value(value) when is_list(value) do
    "[" <> Enum.map_join(value, ",", &encode_canonical_value/1) <> "]"
  end

  defp encode_canonical_value(value) when is_map(value) do
    value
    |> Enum.map(fn {key, item} -> {to_string(key), item} end)
    |> Enum.sort_by(fn {key, _} -> utf16_sort_key(key) end)
    |> Enum.map_join(",", fn {key, item} ->
      Jason.encode!(key) <> ":" <> encode_canonical_value(item)
    end)
    |> then(&("{" <> &1 <> "}"))
  end

  defp encode_canonical_value(value) do
    raise ArgumentError, "Canonical Envelope v1 rejects #{inspect(value)}"
  end

  defp serialize_float(value) do
    raw = :erlang.float_to_binary(value, [:short]) |> String.downcase()
    absolute = abs(value)

    cond do
      value == 0.0 ->
        "0"

      trunc(value) == value and absolute > 9_007_199_254_740_991 ->
        raise ArgumentError, "Canonical Envelope v1 rejects unsafe integer"

      absolute >= 1.0e-6 and absolute < 1.0e21 ->
        raw
        |> expand_scientific_if_needed()
        |> trim_fraction()

      String.contains?(raw, "e") ->
        normalize_exponent(raw)

      true ->
        fixed_to_scientific(raw)
    end
  rescue
    ArithmeticError -> raise ArgumentError, "Canonical Envelope v1 rejects non-finite number"
  end

  defp expand_scientific_if_needed(raw) do
    if String.contains?(raw, "e"), do: expand_scientific(raw), else: raw
  end

  defp trim_fraction(raw) do
    if String.contains?(raw, ".") do
      raw |> String.trim_trailing("0") |> String.trim_trailing(".")
    else
      raw
    end
  end

  defp normalize_exponent(raw) do
    [mantissa, exponent_text] = String.split(raw, "e", parts: 2)
    exponent = String.to_integer(exponent_text)
    mantissa = String.trim_trailing(mantissa, ".0")
    sign = if exponent >= 0, do: "+", else: "-"
    "#{mantissa}e#{sign}#{abs(exponent)}"
  end

  defp expand_scientific(raw) do
    [mantissa, exponent_text] = String.split(raw, "e", parts: 2)
    exponent = String.to_integer(exponent_text)
    negative = String.starts_with?(mantissa, "-")
    mantissa = String.trim_leading(mantissa, "-")
    decimal_index = String.split(mantissa, ".", parts: 2) |> hd() |> String.length()
    digits = String.replace(mantissa, ".", "")
    new_index = decimal_index + exponent

    body =
      cond do
        new_index <= 0 -> "0." <> String.duplicate("0", -new_index) <> digits
        new_index >= String.length(digits) -> digits <> String.duplicate("0", new_index - String.length(digits))
        true -> String.slice(digits, 0, new_index) <> "." <> String.slice(digits, new_index..-1//1)
      end

    if negative, do: "-" <> body, else: body
  end

  defp fixed_to_scientific(raw) do
    negative = String.starts_with?(raw, "-")
    raw = String.trim_leading(raw, "-")
    [integer | rest] = String.split(raw, ".", parts: 2)
    fraction = List.first(rest) || ""

    {digits, exponent} =
      case first_nonzero(integer) do
        nil ->
          index = first_nonzero(fraction)
          if is_nil(index), do: {"0", 0}, else: {String.slice(fraction, index..-1//1), -(index + 1)}

        index ->
          {String.slice(integer, index..-1//1) <> fraction, String.length(integer) - index - 1}
      end

    digits = String.trim_trailing(digits, "0")
    mantissa =
      if String.length(digits) > 1 do
        String.first(digits) <> "." <> String.slice(digits, 1..-1//1)
      else
        digits
      end

    mantissa = if negative, do: "-" <> mantissa, else: mantissa
    sign = if exponent >= 0, do: "+", else: "-"
    "#{mantissa}e#{sign}#{abs(exponent)}"
  end

  defp first_nonzero(value) do
    value
    |> String.graphemes()
    |> Enum.find_index(&(&1 != "0"))
  end

  defp utf16_sort_key(value) do
    value
    |> String.to_charlist()
    |> Enum.flat_map(fn
      codepoint when codepoint <= 0xFFFF -> [codepoint]
      codepoint ->
        adjusted = codepoint - 0x10000
        [0xD800 + Bitwise.bsr(adjusted, 10), 0xDC00 + Bitwise.band(adjusted, 0x3FF)]
    end)
  end

  defp get_field(map, key) when is_binary(key) do
    Map.get(map, key) ||
      try do
        Map.get(map, String.to_existing_atom(key))
      rescue
        ArgumentError -> nil
      end
  end
end

