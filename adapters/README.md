# LTP Adapters

This directory contains minimal, thin adapters to integrate LTP with popular agent frameworks.
The goal is to demonstrate LTP as an external "backbone" of safety, not a replacement framework.

## Adapters

*   `langchain/`: Wraps tools to enforce admissibility before execution.
*   `autogpt/`: Intercepts commands in the AutoGPT loop.
*   `crewai/`: Supervises task assignment and execution.

## Usage

These are reference implementations. Copy the pattern into your specific agent setup.
