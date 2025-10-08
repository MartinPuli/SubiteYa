# Contributing to SubiteYa

Thank you for your interest in contributing to SubiteYa! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the best outcome for the project
- Show empathy towards other contributors

## Getting Started

1. **Fork the repository**
2. **Clone your fork**:

   ```bash
   git clone https://github.com/your-username/SubiteYa.git
   cd SubiteYa
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Create a branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Before You Code

1. Check existing issues to avoid duplication
2. Open an issue to discuss major changes
3. Read relevant ADRs in `/docs/adr`
4. Review package README for context

### While Coding

#### Code Quality Standards

**File Size Limits** (enforced):

- Maximum **250 lines per file** (exception: 300 with justification)
- Maximum **40 lines per function**
- Split large files into smaller modules

**Architecture Principles**:

- One responsibility per file
- Follow clean architecture layers (Domain/Application/Interface/Infrastructure)
- Use barrel exports (`index.ts`) for public APIs
- Keep dependencies unidirectional

**Naming Conventions**:

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)

**Testing**:

- Write tests for new features
- Maintain or improve coverage
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical flows

### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
type(scope): subject

[optional body]

[optional footer]
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks

**Examples**:

```bash
feat(api): add multi-account publishing endpoint

fix(jobs): resolve retry backoff calculation bug

docs(adr): add decision record for job queue strategy

refactor(shared): extract validation helpers to separate file
```

### Pre-commit Hooks

Pre-commit hooks automatically run:

- Prettier formatting
- ESLint fixes
- Basic type checking

If hooks fail, fix issues before committing.

## Pull Request Process

### 1. Prepare Your PR

- Ensure all tests pass: `npm run test`
- Run linter: `npm run lint`
- Format code: `npm run format`
- Build successfully: `npm run build`

### 2. Create Pull Request

- Use a descriptive title (following commit conventions)
- Fill out the PR template
- Link related issues
- Add screenshots for UI changes

### 3. PR Review

- Address reviewer feedback promptly
- Keep discussions focused and professional
- Update PR based on suggestions
- Request re-review when ready

### 4. Merging

- Squash commits if requested
- Ensure CI passes
- Maintainer will merge when approved

## Project Structure

```
/packages
  /api          → Backend API (Express, Prisma)
  /jobs         → Background jobs (BullMQ)
  /tiktok       → TikTok client integration
  /web          → Frontend (React, Vite)
  /shared       → Common utilities and types
  /observability → Logging and metrics
  /security     → Security middleware
  /storage      → File management

/docs
  /adr          → Architecture Decision Records
  /guides       → Integration and setup guides
  /api          → API documentation
```

## Testing

### Run Tests

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

### Writing Tests

- Place tests next to source files: `foo.test.ts`
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies
- Test edge cases and error handling

## Documentation

### When to Update Docs

- New features or APIs
- Breaking changes
- Architecture decisions (ADRs)
- Setup/configuration changes

### Documentation Standards

- Use clear, concise language
- Include code examples
- Keep README files up to date
- Add JSDoc comments for public APIs

## Reporting Issues

### Bug Reports

Include:

- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version)
- Screenshots or logs (if applicable)

### Feature Requests

Include:

- Clear description of the feature
- Use case and benefits
- Proposed implementation (optional)
- Alternatives considered (optional)

## Questions?

- Open a GitHub Discussion
- Tag maintainers in issues
- Check existing documentation

## Recognition

Contributors will be recognized in:

- `CHANGELOG.md` for notable contributions
- GitHub contributors list
- Release notes (for significant features)

---

**Thank you for contributing to SubiteYa!** 🙏
