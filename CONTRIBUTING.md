# Contributing to OpenHealthOS

Thank you for your interest in contributing to TheOpenHealthOS! This guide will help you get started.

## 🎯 Ways to Contribute

### Code Contributions
- Implement healthcare protocols (FHIR, HL7, DICOM)
- Build service components
- Add device simulators
- Improve security & compliance features
- Write tests
- Fix bugs

### Non-Code Contributions
- Documentation improvements
- User guides and tutorials
- Architecture diagrams
- Healthcare use case examples
- Testing and bug reports
- Community support

## 🏗️ Development Setup

### Prerequisites
- Git
- Docker & Docker Compose
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+ (for local development)

### Initial Setup
```bash
# Fork the repository on GitHub, then:
git clone https://github.com/Mru00-hub/theopenhealthos.git
cd theopenhealthos

# Add upstream remote
git remote add upstream https://github.com/theopenhealthos/theopenhealthos.git

# Install dependencies
npm install  # Root level
cd simulators/layer2-microservices && npm install

# Start Docker services
docker-compose up -d

# Verify setup
docker-compose ps
npm test
```

### Development Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
npm test
npm run lint

# Commit with conventional commits format
git commit -m "feat: add FHIR patient resource handler"

# Push and create PR
git push origin feature/your-feature-name
```

## 📝 Pull Request Process

1. **Check existing issues** - Search for related issues or create one
2. **Fork & Branch** - Create a descriptive branch name
3. **Make changes** - Follow our coding standards
4. **Add tests** - All new code must have tests
5. **Update docs** - Document new features/changes
6. **Run checks** - Ensure all tests and lints pass
7. **Submit PR** - Use our PR template

### PR Requirements
- ✅ All tests passing
- ✅ Code coverage maintained or improved
- ✅ No linting errors
- ✅ Documentation updated
- ✅ Commit messages follow convention
- ✅ CHANGELOG.md updated (for significant changes)

## 🧪 Testing Standards

### Required Tests
- **Unit Tests** - For all functions and methods
- **Integration Tests** - For API endpoints
- **E2E Tests** - For critical workflows
- **Security Tests** - For authentication/authorization

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "FHIR"

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Coverage Requirements
- Minimum 80% code coverage
- 100% coverage for security-critical code
- All public APIs must have tests

## 📐 Code Standards

### JavaScript/TypeScript
```bash
# Linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

**Standards:**
- ESLint configuration (Airbnb base)
- Prettier for formatting
- TypeScript strict mode enabled
- JSDoc comments for public APIs

### Python
```bash
# Linting
python -m flake8 services/

# Formatting
python -m black services/

# Type checking
python -m mypy services/
```

**Standards:**
- Black code formatter
- Flake8 linter
- Type hints required
- Docstrings (Google style)

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix bug
docs: documentation only
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance tasks
```

Examples:
```
feat(fhir): add patient resource CRUD operations
fix(security): resolve authentication bypass vulnerability
docs(api): update FHIR endpoint documentation
```

## 🏥 Healthcare-Specific Guidelines

### HIPAA Compliance
- **Never** commit real PHI (Protected Health Information)
- Use synthetic patient data only
- All PHI access must be logged
- Implement proper access controls
- Encrypt sensitive data

### Data Privacy
- Anonymize all test data
- Use FHIR test patients (synthea)
- Remove identifiers from logs
- Follow minimum necessary principle

### Standards Compliance
- **FHIR**: Follow FHIR R4 specification strictly
- **HL7**: Adhere to HL7 v2/v3 standards
- **DICOM**: Follow DICOM standard for imaging
- **Terminology**: Use standard code systems (SNOMED, LOINC, RxNorm)

### Medical Device Integration
- Follow IEC 62304 for medical software
- Implement proper error handling
- Add device-specific safety checks
- Document all device protocols

## 🎯 Priority Areas

### High Priority
- [ ] FHIR R4 resource handlers (Patient, Observation, Condition)
- [ ] HL7 v2 message parser and router
- [ ] Security audit logging system
- [ ] OAuth2/OIDC authentication
- [ ] DICOM image handling

### Medium Priority
- [ ] ML model deployment pipeline
- [ ] Device simulators (ECG, vitals monitors)
- [ ] Terminology service (SNOMED CT)
- [ ] Clinical decision support rules engine
- [ ] API documentation (OpenAPI/Swagger)

### Good First Issues
Look for issues tagged with:
- `good first issue`
- `help wanted`
- `documentation`
- `beginner-friendly`

## 📚 Resources

### Healthcare Standards
- [FHIR Specification](https://hl7.org/fhir/)
- [HL7 Standards](https://www.hl7.org/)
- [DICOM Standard](https://www.dicomstandard.org/)
- [SNOMED CT](https://www.snomed.org/)

### Tools & Libraries
- [HAPI FHIR](https://hapifhir.io/) - FHIR server
- [Synthea](https://synthetichealth.github.io/synthea/) - Synthetic patient data
- [Mirth Connect](https://www.nextgen.com/products-and-services/mirth-connect-integration-engine-downloads) - HL7 integration
- [DCM4CHE](https://www.dcm4che.org/) - DICOM toolkit

### Learning Resources
- [FHIR for Developers](https://www.hl7.org/fhir/overview-dev.html)
- [HL7 v2 Tutorial](https://hl7-definition.caristix.com/v2/)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html)

## 🐛 Reporting Bugs

### Bug Report Template
```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. ...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., Ubuntu 22.04]
- Docker version:
- Node version:
- Browser (if applicable):

**Additional Context**
Any other relevant information
```

### Security Vulnerabilities
**DO NOT** open public issues for security vulnerabilities.

Email: mrudulabhalke75917@gmail.com

Include:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## 💡 Feature Requests

Use GitHub Discussions for feature ideas before creating issues.

Include:
- Use case description
- Proposed solution
- Healthcare standards involved
- Potential challenges

## 👥 Code Review Process

### For Contributors
- Respond to review comments promptly
- Keep PRs focused and reasonably sized
- Update PR based on feedback
- Be open to suggestions

### For Reviewers
- Review within 48 hours when possible
- Be constructive and respectful
- Check for security implications
- Verify healthcare standards compliance
- Test the changes locally

## 📋 Project Governance

### Decision Making
- **Minor changes** - Any maintainer can merge
- **Major changes** - Require 2+ maintainer approvals
- **Architecture changes** - Require project lead approval
- **Breaking changes** - Require community discussion

### Maintainer Responsibilities
- Code review
- Issue triage
- Release management
- Community engagement
- Documentation maintenance

## 🏆 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Eligible for contributor swag (planned)
- Invited to community calls

## 📞 Getting Help

- **GitHub Discusions** - For general discussions
- **Email** - mrudulabhalke75917@gmail.com

## 📜 Code of Conduct

We follow the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

**TL;DR:** Be respectful, professional, and inclusive.

## 📄 License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

**Thank you for contributing to better healthcare technology!** 🏥💙
