# Contributing to L-THREAD / LTP

Thank you for your interest in contributing to LTP! This document provides guidelines and instructions for contributing.

## Governance quickstart
- Read and follow [GOVERNANCE.md](./GOVERNANCE.md); it defines roles, permissions, and core change rules.
- Contributors may work on SDKs, tooling (inspectors, visualizers), demos, docs, and tests.
- Only Core Maintainers may approve changes that alter protocol semantics, orientation invariants, or golden traces.
- Any proposal that touches `core/`, `protocol/`, or golden traces requires an RFC plus updated traces showing deterministic behavior.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/your-username/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-.git
   cd L-THREAD-Liminal-Thread-Secure-Protocol-LTP-
   ```

3. **Set up development environment:**
   ```bash
   # JavaScript SDK
   cd sdk/js && npm install
   
   # Python SDK
   cd sdk/python && pip install -e .
   
   # Elixir SDK
   cd sdk/elixir && mix deps.get
   
   # Rust SDK
   cd sdk/rust/ltp-client && cargo build
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Follow existing code style and patterns
- Write clear, self-documenting code
- Add comments for complex logic
- Update documentation as needed
- Stay within the contributor scope unless a Core Maintainer sponsors the change and an RFC is in flight
- Do not introduce bidirectional controls or hidden Unicode characters into normative specs; rewrite affected lines using visible ASCII/Unicode only

### 3. Write Tests

- Add tests for new features
- Ensure all existing tests pass
- Aim for good test coverage

### 4. Commit Changes

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add new feature description"
git commit -m "fix: resolve issue description"
git commit -m "docs: update documentation"
```

**Commit message prefixes:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Reference to related issues
- Screenshots/examples if applicable

## Coding Standards

### JavaScript/TypeScript

- Use TypeScript for type safety
- Follow ESLint configuration
- Use async/await for async operations
- Write JSDoc comments for public APIs

### Python

- Follow PEP 8 style guide
- Use type hints where possible
- Write docstrings for functions/classes
- Use async/await for async operations

### Elixir

- Follow Elixir style guide
- Use `@moduledoc` and `@doc` for documentation
- Prefer pattern matching
- Use GenServer for stateful processes

### Rust

- Follow Rust style guide (rustfmt)
- Use `#[derive(Debug)]` for structs
- Write doc comments (`///`)
- Handle errors with Result types

## Testing

### Running Tests

```bash
# JavaScript
cd sdk/js && npm test

# Python
cd sdk/python && pytest

# Elixir
cd sdk/elixir && mix test

# Rust
cd sdk/rust/ltp-client && cargo test
```

### Test Requirements

- All tests must pass
- New features require tests
- Maintain or improve test coverage
- Tests should be fast and isolated

## Documentation

- Update README.md if adding features
- Add examples for new functionality
- Update API.md for API changes
- Keep specs/ up to date for protocol changes

## Protocol Changes

If proposing protocol changes (Core Maintainer approval required):

1. **Open an RFC** documenting the change and why determinism/orientation are preserved.
2. **Update specifications** in `specs/` and any relevant docs.
3. **Update golden traces** and conformance fixtures to demonstrate the new behavior.
4. **Update SDKs** to maintain compatibility where applicable.
5. **Add migration guide** if breaking changes and update version numbers appropriately.

## Pull Request Process

1. **Ensure CI passes** - All tests must pass
2. **Update documentation** - Keep docs current
3. **Request review** - Tag relevant maintainers
4. **Address feedback** - Respond to review comments
5. **Squash commits** - If requested by maintainers

## Reporting Issues

When reporting issues, include:

- **Description** - Clear problem description
- **Steps to reproduce** - How to trigger the issue
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Environment** - OS, SDK version, etc.
- **Logs** - Relevant error messages/logs

## Feature Requests

For feature requests:

- **Use case** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternatives** - Other approaches considered
- **Impact** - Who benefits from this?

## Questions?

- Open an issue for questions
- Check existing documentation
- Review examples in `examples/`
- Check `ARCHITECTURE.md` for design decisions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

Thank you for contributing to LTP! 🚀
