defmodule LTPServerExample.MixProject do
  use Mix.Project

  def project do
    [
      app: :ltp_server_example,
      version: "0.1.0",
      elixir: "~> 1.14",
      deps: deps()
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
      {:ranch, "~> 2.1"},
      {:uuid, "~> 1.1"}
    ]
  end
end

