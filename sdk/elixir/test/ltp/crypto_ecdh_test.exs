defmodule LTP.CryptoECDHTest do
  use ExUnit.Case, async: true

  test "generated P-256 key pairs derive the same shared secret" do
    {public_a, private_a} = LTP.Crypto.generate_ecdh_key_pair()
    {public_b, private_b} = LTP.Crypto.generate_ecdh_key_pair()

    assert byte_size(Base.decode16!(public_a, case: :lower)) == 65
    assert byte_size(Base.decode16!(private_a, case: :lower)) == 32
    assert byte_size(Base.decode16!(public_b, case: :lower)) == 65
    assert byte_size(Base.decode16!(private_b, case: :lower)) == 32

    secret_a = LTP.Crypto.derive_shared_secret(private_a, public_b)
    secret_b = LTP.Crypto.derive_shared_secret(private_b, public_a)

    assert secret_a == secret_b
    assert byte_size(Base.decode16!(secret_a, case: :lower)) == 32
  end
end
