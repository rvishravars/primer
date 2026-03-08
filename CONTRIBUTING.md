# Contributing to Primer

Welcome! Primer thrives on collaboration, open ideas, and community contributions. We're excited to have you help expand and improve this lightweight, Git-backed framework.

## Our Philosophy

Primer is built on principles of:
- **Lightweight Design**: Keep it simple, fast, and easy to understand
- **Git-Backed**: All content and data live in Git repositories
- **Open Collaboration**: Ideas are shared, discussed, and refined together
- **Framework Expansion**: Help us grow the capabilities and reach of the platform

## How to Contribute

### 1. Ideas & Enhancements

Have an idea for a new feature, improvement, or expansion? We'd love to hear it!

**Start by opening an enhancement issue on GitHub:**
- Go to the [GitHub Issues](https://github.com/rvishravars/primer/issues) page
- Click "New Issue"
- Select the "Enhancement" template (or create a blank issue)
- Clearly describe:
  - **What problem does this solve?**
  - **How would it work?**
  - **Why is it important for Primer?**
  - **Any alternative approaches you considered**

Examples of great contributions:
- New spark phases or mission types
- Enhanced reflection and feedback mechanisms
- Better collaboration workflows
- Performance optimizations
- Documentation improvements

### 2. Bug Reports

Found a bug? Help us fix it!

**Open a bug report issue with:**
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, browser, Docker version)
- Screenshots or logs if possible

### 3. Pull Requests

Ready to code? We welcome pull requests!

**Before starting:**
- Comment on an existing issue or create one first
- Discuss your approach in the issue
- Wait for feedback from maintainers

**When submitting a PR:**
- Keep changes focused and atomic
- Write clear commit messages
- Add tests for new features
- Update documentation if needed
- Reference the related issue: `Fixes #123`

**Branch naming:**
```bash
feature/description          # New features
bugfix/description           # Bug fixes
docs/description             # Documentation
refactor/description         # Code improvements
```

### 4. Documentation

Documentation improvements are always welcome!

- Fix typos or unclear passages
- Add examples or tutorials
- Improve architecture docs
- Create setup guides for new platforms

## Development Setup

### Prerequisites
- Node.js 16+ with npm
- Python 3.8+
- Docker & Docker Compose
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/rvishravars/primer.git
cd primer

# Start the development environment
cd spark-assembly-lab
docker compose up --build

# Visit http://localhost:3000
```

### Project Structure

```
primer/
├── spark-assembly-lab/          # Main application
│   ├── src/                     # React frontend
│   ├── server_py/               # Flask backend
│   ├── scribe/                  # Python utilities
│   └── docker-compose.yml
├── sparks/                      # Example sparks
├── templates/                   # Spark templates
└── docs/                        # Documentation
```

## Code Standards

### Frontend (React/JavaScript)
- Use functional components with hooks
- Follow existing naming conventions
- Keep components focused and reusable
- Add comments for complex logic
- Test on mobile and desktop

### Backend (Python/Flask)
- Follow PEP 8 style guidelines
- Use type hints where beneficial
- Add docstrings to functions
- Keep endpoints RESTful
- Validate all inputs

### General
- Keep commits atomic and meaningful
- Write descriptive commit messages
- Avoid committing sensitive data (keys, tokens)
- Test your changes locally first

## Community Guidelines

We're committed to a welcoming and inclusive community. Please:
- Be respectful and constructive in discussions
- Assume good intent
- Provide feedback on ideas thoughtfully
- Help others who are learning
- Share knowledge generously

## Getting Help

- **Questions?** Open a discussion or ask in an issue
- **Stuck?** Comment on the issue and ask for clarification
- **Want to pair?** Reach out on GitHub
- **Need more context?** Check existing documentation and examples

## Licensing

By contributing, you agree that your contributions will be licensed under the same license as the project. Please ensure you have rights to contribute code you submit.

## What's Next?

After your first contribution, you might:
- Join ongoing discussions
- Review other PRs (we value community feedback)
- Help with documentation or tutorials
- Become a maintainer (for active contributors)

---

**Thank you for helping build Primer!** Every contribution—no matter how small—makes the framework better for everyone. 🙌

**Ready to contribute?** → [Create an issue](https://github.com/rvishravars/primer/issues/new)
