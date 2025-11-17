defmodule LTP.MixProject do
  use Mix.Project

  @version "0.1.0"
  @source_url "https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-"

  def project do
    [
      app: :ltp_elixir,
      version: @version,
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      description: "LTP (Liminal Thread Protocol) client SDK for Elixir/Erlang",
      package: package(),
      docs: [
        main: "LTP",
        source_url: @source_url
      ],
      test_paths: ["test"]
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:websockex, "~> 0.5"},
      {:jason, "~> 1.4"},
      {:ex_doc, "~> 0.30", only: :dev, runtime: false},
      {:ex_unit_notifier, "~> 1.0", only: :test}
    ]
  end

  defp package do
    [
      maintainers: ["LIMINAL Team"],
      licenses: ["MIT"],
      links: %{"GitHub" => @source_url},
      files: ~w(lib mix.exs README.md LICENSE)
    ]
  end
end

