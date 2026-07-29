defmodule LTP.CanonicalEnvelopeV1Test do
  use ExUnit.Case, async: true

  @root Path.expand("../../../..", __DIR__)

  test "matches the shared golden vector" do
    fixture =
      @root
      |> Path.join("tests/security/canonical-envelope-v1.json")
      |> File.read!()
      |> Jason.decode!()

    expected =
      @root
      |> Path.join("tests/security/canonical-envelope-v1.txt")
      |> File.read!()
      |> String.trim_trailing()

    assert LTP.Crypto.serialize_canonical(fixture) == expected
  end

  test "rejects unsafe integers" do
    assert_raise ArgumentError, ~r/unsafe integer/, fn ->
      LTP.Crypto.serialize_canonical(%{"payload" => %{"unsafe" => 9_007_199_254_740_992}})
    end
  end
end
