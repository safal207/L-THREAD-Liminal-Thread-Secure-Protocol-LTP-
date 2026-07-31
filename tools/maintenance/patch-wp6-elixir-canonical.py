from pathlib import Path

path = Path("sdk/elixir/lib/ltp/crypto.ex")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        '      "payload" => get_field(message, "payload") || %{},',
        '      "payload" => get_field_preserving_json_value(message, "payload", %{}),',
    ),
    (
        '  defp encode_canonical_value(value) when is_binary(value), do: Jason.encode!(value)',
        '  defp encode_canonical_value(value) when is_binary(value), do: encode_json_string(value)',
    ),
    (
        '      Jason.encode!(key) <> ":" <> encode_canonical_value(item)',
        '      encode_json_string(key) <> ":" <> encode_canonical_value(item)',
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one occurrence of {old!r}, found {count}")
    text = text.replace(old, new, 1)

anchor = '''  defp get_field(map, key) when is_binary(key) do
'''
if text.count(anchor) != 1:
    raise SystemExit("get_field helper anchor drifted")

helpers = '''  defp encode_json_string(value) do
    Regex.replace(~r/\\\\u[0-9A-Fa-f]{4}/, Jason.encode!(value), fn escape ->
      "\\\\u" <> (escape |> String.slice(2, 4) |> String.downcase())
    end)
  end

  defp get_field_preserving_json_value(map, key, default) when is_binary(key) do
    case Map.fetch(map, key) do
      {:ok, value} ->
        value

      :error ->
        try do
          case Map.fetch(map, String.to_existing_atom(key)) do
            {:ok, value} -> value
            :error -> default
          end
        rescue
          ArgumentError -> default
        end
    end
  end

'''

text = text.replace(anchor, helpers + anchor, 1)
path.write_text(text, encoding="utf-8")
print("patched", path)
