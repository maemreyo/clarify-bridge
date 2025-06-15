# Documentation Structure

```
docs/
├── api/                    # Auto-generated API docs (TypeDoc)
│   └── index.html         # Entry point for API documentation
│
├── assets/                # Documentation assets
│   ├── custom.css        # Custom styling for TypeDoc
│   └── images/           # Images for documentation
│
├── guides/               # Manual guides and tutorials
│   ├── getting-started.md
│   ├── architecture.md
│   ├── development.md
│   ├── deployment.md
│   └── contributing.md
│
├── examples/             # Code examples
│   ├── basic-usage/
│   ├── advanced-features/
│   └── integrations/
│
└── diagrams/            # Architecture diagrams
    ├── system-overview.mmd
    ├── data-flow.mmd
    └── deployment.mmd
```

## Quick Commands

```bash
# Generate API documentation
pnpm docs:generate

# Serve documentation locally
pnpm docs:serve

# Watch mode for development
pnpm docs:watch

# Clean and regenerate
rm -rf docs/api && pnpm docs:generate
```

## Documentation Types

1. **API Reference** (auto-generated)
   - Generated from JSDoc comments
   - TypeDoc output in `docs/api/`
   - Includes all classes, interfaces, enums

2. **Guides** (manual)
   - Written in Markdown
   - Stored in `docs/guides/`
   - Tutorial-style documentation

3. **Examples** (manual)
   - Working code examples
   - Stored in `docs/examples/`
   - Can be tested independently

4. **Diagrams** (manual)
   - Mermaid diagrams
   - Architecture visualizations
   - Stored in `docs/diagrams/`
