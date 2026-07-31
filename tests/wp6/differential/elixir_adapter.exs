defmodule LTP.WP6DifferentialAdapter do
  defp value_depth(value, depth) when is_list(value) do
    Enum.reduce(value, depth + 1, fn item, maximum -> max(maximum, value_depth(item, depth + 1)) end)
  end

  defp value_depth(value, depth) when is_map(value) do
    Enum.reduce(Map.values(value), depth + 1, fn item, maximum ->
      max(maximum, value_depth(item, depth + 1))
    end)
  end

  defp value_depth(_value, depth), do: depth

  defp classify(entry, limits) do
    base = %{"id" => entry["id"], "category" => entry["category"]}
    raw = entry["raw_json"]

    cond do
      byte_size(raw) > limits["max_input_bytes"] ->
        Map.merge(base, %{"verdict" => "REJECTED", "reason" => "INPUT_TOO_LARGE"})

      true ->
        case Jason.decode(raw) do
          {:error, _} ->
            Map.merge(base, %{"verdict" => "REJECTED", "reason" => "INVALID_JSON"})

          {:ok, parsed} ->
            cond do
              value_depth(parsed, 0) > limits["max_depth"] ->
                Map.merge(base, %{"verdict" => "REJECTED", "reason" => "MAX_DEPTH_EXCEEDED"})

              not is_map(parsed) ->
                Map.merge(base, %{"verdict" => "REJECTED", "reason" => "CANONICAL_REJECTED"})

              true ->
                try do
                  canonical = LTP.Crypto.serialize_canonical(parsed)
                  digest = :crypto.hash(:sha256, canonical) |> Base.encode16(case: :lower)

                  Map.merge(base, %{
                    "verdict" => "ACCEPTED",
                    "reason" => "ACCEPTED",
                    "canonical_digest" => digest
                  })
                rescue
                  _ -> Map.merge(base, %{"verdict" => "REJECTED", "reason" => "CANONICAL_REJECTED"})
                end
            end
        end
    end
  end

  def run([corpus_path, output_path]) do
    corpus = corpus_path |> File.read!() |> Jason.decode!()

    report = %{
      "schema_version" => 1,
      "profile" => "org.ltp.wp6.sdk-differential-report.v1",
      "sdk" => "elixir",
      "corpus_digest" => corpus["corpus_digest"],
      "limits" => corpus["limits"],
      "results" => Enum.map(corpus["cases"], &classify(&1, corpus["limits"]))
    }

    File.write!(output_path, Jason.encode!(report, pretty: true) <> "\n")
  end

  def run(_), do: raise("usage: elixir_adapter.exs <corpus.json> <output.json>")
end

LTP.WP6DifferentialAdapter.run(System.argv())
