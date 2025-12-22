# Contributing to ultramac-mcp

Thank you for your interest in contributing! This guide will help you get started.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build great software together.

## How Can I Contribute?

### 1. Reporting Bugs

**Before submitting:**

- Check existing issues
- Update to latest version
- Test in clean environment

**What to include:**

- Operating system & version
- Bun version (`bun --version`)
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

**Template:**

```markdown
**Environment:**

- OS: macOS 14.1
- Bun: 1.3.5
- ultramac-mcp: 1.0.0

**Steps to Reproduce:**

1. ...
2. ...

**Expected:** ...
**Actual:** ...
**Logs:** ...
```

### 2. Suggesting Features

**Before suggesting:**

- Check existing feature requests
- Consider if it fits project scope
- Think about backwards compatibility

**What to include:**

- Use case / problem to solve
- Proposed solution
- Alternative solutions considered
- Willingness to implement

### 3. Contributing Code

## Getting Started

### Prerequisites

- **Bun**: 1.3+ (`curl -fsSL https://bun.sh/install | bash`)
- **macOS**: 12+ (for full automation features)
- **Git**: Latest

### Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/ultramac-mcp.git
cd ultramac-mcp

# Install dependencies
bun install

# Run tests
bun test

# Start development server
bun run index.ts --stdio
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/bug-description
```

**Branch naming:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 2. Make Changes

**Code style:**

- TypeScript strict mode
- 2-space indentation
- Descriptive variable names
- JSDoc comments for public APIs

**Example:**

```typescript
/**
 * Sanitize a file path to prevent directory traversal
 * @param filePath - Path to sanitize
 * @returns Sanitized absolute path
 * @throws {Error} If path is outside allowed directories
 */
export function sanitizeFilePath(filePath: string): string {
  // Implementation...
}
```

### 3. Add Tests

**Required:**

- Unit tests for new functions
- Integration tests for new tools
- Update existing tests if behavior changes

**Example:**

```typescript
describe("myNewFeature", () => {
  it("should handle valid input", () => {
    const result = myNewFeature("input");
    expect(result).toBe("expected");
  });

  it("should throw on invalid input", () => {
    expect(() => myNewFeature("")).toThrow();
  });
});
```

**Run tests:**

```bash
bun test                    # All tests
bun test myfile.test.ts     # Specific file
bun test --coverage         # With coverage
```

### 4. Update Documentation

**If you:**

- Add a new tool → Update README.md
- Change API → Update docs/API_VERSIONING.md
- Add configuration → Update docs/
- Fix security issue → Update SECURITY.md

### 5. Commit

**Commit message format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Example:**

```bash
git commit -m "feat(auth): add API key rotation support

- Add generateApiKey() function
- Add revokeApiKey() function
- Update documentation

Closes #123"
```

### 6. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a Pull Request on GitHub.

## Pull Request Process

### PR Checklist

- [ ] Tests pass (`bun test`)
- [ ] No TypeScript errors (`bunx tsc --noEmit`)
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Template

```markdown
## Description

Briefly describe what this PR does

## Motivation

Why is this change needed?

## Changes

- Change 1
- Change 2

## Testing

How was this tested?

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Backwards compatible (or BREAKING CHANGE in commit)
- [ ] Ready for review
```

### Review Process

1. **Automated checks**: CI must pass
2. **Code review**: At least one approval required
3. **Testing**: Manual testing if needed
4. **Merge**: Squash and merge by maintainer

## Development Guidelines

### Security

**Always:**

- Sanitize user input
- Use command whitelist
- Validate file paths
- Log security events
- Review `npm audit`

**Never:**

- Execute arbitrary shell commands
- Trust user input
- Expose stack traces to clients
- Commit API keys
- Disable security features

### Performance

- Profile before optimizing
- Cache expensive operations
- Use async where appropriate
- Monitor memory usage
- Add metrics for new features

### Testing

**Coverage targets:**

- Overall: 95%+
- New code: 100%
- Critical paths: 100%

**Test types:**

1. **Unit**: Individual functions
2. **Integration**: Tool execution
3. **Security**: Input validation, sanitization

### Documentation

**Code comments:**

- JSDoc for public APIs
- Inline comments for complex logic
- Examples in documentation

**README updates:**

- New tools → Features section
- Breaking changes → Migration guide
- Configuration → Setup section

## Project Structure

```
ultramac-mcp/
├── src/
│   ├── security-utils.ts   # Input sanitization
│   ├── audit-logger.ts     # Winston logging
│   ├── auth.ts             # Authentication
│   ├── health.ts           # Health checks
│   ├── metrics.ts          # Prometheus
│   ├── action-logger.ts    # Action history
│   └── ocr-cache.ts        # OCR caching
├── __tests__/              # Test files
├── docs/                   # Documentation
├── .github/               # CI/CD workflows
└── index.ts               # Main server
```

## Adding a New Tool

1. **Define schema** in index.ts:

   ```typescript
   server.addTool({
     name: "my_tool",
     description: "What it does",
     schema: {
       type: "object",
       properties: {
         param: z.string().describe("Parameter description"),
       },
       required: ["param"],
     },
     execute: async ({ param }) => {
       // Implementation
     },
   });
   ```

2. **Add tests** in `__tests__/`:

   ```typescript
   describe("my_tool", () => {
     // Test cases
   });
   ```

3. **Update docs**:
   - README.md (tools table)
   - CHANGELOG.md
   - docs/ARCHITECTURE.md (if needed)

## Release Process (Maintainers Only)

1. Update CHANGELOG.md
2. Bump version in package.json
3. Create git tag: `git tag v1.x.x`
4. Push tag: `git push --tags`
5. GitHub Actions builds and publishes Docker image
6. Create GitHub Release with notes

## Getting Help

- **Questions**: GitHub Discussions
- **Bugs**: GitHub Issues
- **Security**: See SECURITY.md
- **Chat**: (To be added)

## Recognition

Contributors will be:

- Listed in CHANGELOG.md
- Mentioned in release notes
- Added to contributors list (if significant contribution)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (to be specified).

---

**Thank you for contributing!** 🎉
