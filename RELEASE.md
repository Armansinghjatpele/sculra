# Release & Versioning Policy - Sculra

Sculra aligns release tags and code modifications strictly to **Semantic Versioning (SemVer)** standards.

---

## 1. Version Layout (`MAJOR.MINOR.PATCH`)

- **MAJOR**: Breaking API configurations or deep architectural re-scaffolding changes.
- **MINOR**: Backward-compatible new capabilities additions (like adding new AI agents).
- **PATCH**: Backward-compatible styling repairs or database hotfixes.

---

## 2. Release Workflows

1. **Prerequisites**: Check that target staging branch passed CI Action integrations.
2. **Version Bump**:
   Update `package.json` version keys using `pnpm version [major|minor|patch]`.
3. **Commit & Tag**:
   ```bash
   git add package.json
   git commit -m "chore(release): bump version to v1.2.0"
   git tag -a v1.2.0 -m "Release version 1.2.0"
   ```
4. **Push**:
   ```bash
   git push origin main --tags
   ```
