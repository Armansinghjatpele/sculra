# Contributing to Sculra

We are glad you are contributing to Sculra! To maintain high code quality and architecture alignment, all developers must adhere to the workflows outlined in this document.

---

## 1. Branch Naming Conventions

Always name development branches according to the change purpose:

- **Features**: `feat/description-of-feature`
- **Bug Fixes**: `fix/description-of-bug`
- **Documentation**: `docs/topic-name`
- **Performance**: `perf/description`
- **Refactoring**: `refactor/description`

_Example: `feat/stripe-subscription-portal` or `fix/jwt-expiration-race-condition`._

---

## 2. Commit Message Standards

Sculra uses the **Conventional Commits** standard. Commit messages must be structured as follows:

```text
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new user-facing feature.
- `fix`: A bug fix.
- `docs`: Documentation updates.
- `style`: Formatting changes that do not affect code logic (semi, quotes).
- `refactor`: Structural code changes that neither fix bugs nor add features.
- `test`: Adding or correcting tests.
- `chore`: Infrastructure updates, package bumps, dependencies.

_Example: `feat(billing): configure Stripe checkout endpoint hook`._

---

## 3. Local Development Flow

1. **Clone & Install**:
   ```bash
   git clone https://github.com/Sculra/Sculra.git
   cd Sculra
   npm install
   ```
2. **Synchronize Environment**:
   Copy `.env.example` to respective project root directories and set configuration parameters.
3. **Run Dev Servers**:
   ```bash
   npm run dev
   ```
4. **Make Changes**:
   Follow code standards specified in [CodingStandards.md](file:///c:/Users/arman/OneDrive/Desktop/sculra/docs/CodingStandards.md).
5. **Verify Code Quality**:
   Run lints, checks, and formatting tests locally:
   ```bash
   npm run lint
   npm run ts-check
   ```
6. **Submit PR**:
   Open a pull request describing the changes, adding links to related issue tickets, and detailing the testing steps performed.
