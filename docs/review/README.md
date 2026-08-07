# Documentation Review

Ce dossier contient la documentation de review et d'analyse du projet NightHub.

## Fichiers

| Fichier | Description |
|---------|-------------|
| [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md) | Documentation complète du projet |
| [CODE-REVIEW.md](./CODE-REVIEW.md) | Revue du code et recommandations |

## Agents Disponibles

Les agents de développement sont configurés dans `.opencode/agents/`:

| Agent | Description |
|-------|-------------|
| `review-agent` | Agent de revue de code |
| `tdd-agent` | Agent TDD pour développement test-first |
| `dev-agent` | Agent de développement principal |

Pour utiliser un agent, invoquez le skill correspondant:
- `opencode:code-review-agent`
- `opencode:tdd-dev-agent`
- `opencode:dev-agent`