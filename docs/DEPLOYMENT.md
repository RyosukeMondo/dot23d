# Deployment Guide

This document outlines the deployment process for the Dot Art 3D Converter application.

## Overview

The application uses GitHub Actions for continuous integration and deployment to GitHub Pages. The deployment pipeline includes comprehensive testing, security scanning, and validation before going live.

## Deployment Pipeline

### Pipeline Stages

1. **Quality Checks** - Code quality validation
2. **Build & Analysis** - Application build and bundle analysis
3. **End-to-End Testing** - Complete workflow validation
4. **Security Scan** - Vulnerability assessment
5. **Deploy** - GitHub Pages deployment
6. **Post-Deploy Validation** - Production smoke tests
7. **Notification** - Deployment status summary

### Quality Gates

Each stage must pass before proceeding to the next:

- ✅ TypeScript compilation
- ✅ ESLint code quality
- ✅ Unit test coverage
- ✅ Bundle size limits (< 10MB)
- ✅ E2E test validation
- ✅ Security audit (no critical vulnerabilities)
- ✅ Production smoke tests

## Triggers

### Automatic Deployment
- **Push to main branch**: Triggers full deployment pipeline
- **Pull Request merge**: Deployment runs after successful merge

### Manual Deployment
- **Workflow dispatch**: Manual trigger from GitHub Actions UI

## Environment Configuration

### GitHub Pages Settings

The application is deployed to GitHub Pages with the following configuration:

```yaml
# Repository Settings > Pages
Source: GitHub Actions
Custom domain: Not configured (uses default github.io)
HTTPS: Enforced
```

### Required Secrets

No additional secrets are required. The deployment uses:
- `GITHUB_TOKEN`: Automatically provided
- `github-pages` environment: Configured by Actions

### Environment Variables

```bash
# Build-time variables (configured in vite.config.ts)
BASE_URL=/dot-art-3d-converter/
NODE_ENV=production
```

## Build Process

### Build Steps

1. **Install Dependencies**
   ```bash
   npm ci
   ```

2. **Type Check**
   ```bash
   npm run typecheck
   ```

3. **Code Quality**
   ```bash
   npm run lint
   ```

4. **Unit Tests**
   ```bash
   npm run test:coverage
   ```

5. **Build Application**
   ```bash
   npm run build
   ```

6. **Bundle Analysis**
   ```bash
   npm run analyze-bundle
   ```

### Build Outputs

- `dist/` - Production build artifacts
- `coverage/` - Test coverage reports
- `bundle-analysis.json` - Bundle composition analysis
- `e2e-results.json` - E2E test results

## Testing Strategy

### Test Types

1. **Unit Tests** (Vitest)
   - Component functionality
   - Service logic
   - Utility functions
   - Minimum 80% coverage required

2. **End-to-End Tests** (Playwright)
   - Complete user workflows
   - Cross-browser compatibility
   - Visual regression testing
   - Performance validation

3. **Production Smoke Tests**
   - Page load verification
   - Core functionality check
   - JavaScript execution validation
   - Console error detection

### Test Environments

- **Development**: Local testing with `npm run test`
- **CI/CD**: Full test suite in GitHub Actions
- **Production**: Smoke tests after deployment

## Performance Monitoring

### Bundle Size Limits

| Asset Type | Limit | Current |
|------------|-------|---------|
| Total Bundle | <10MB | ~8MB |
| Main JS | <500KB | ~400KB |
| Vendor JS | <2MB | ~1.5MB |
| Three.js | <1MB | ~800KB |

### Performance Metrics

- **Page Load Time**: <2 seconds target
- **First Contentful Paint**: <1.8 seconds
- **Largest Contentful Paint**: <2.5 seconds
- **Cumulative Layout Shift**: <0.1

### Monitoring Tools

- Bundle size analysis in CI
- Core Web Vitals tracking
- Performance budget enforcement
- Automated performance regression detection

## Security

### Security Measures

1. **Dependency Scanning**
   - `npm audit` for known vulnerabilities
   - Automated security updates via Dependabot
   - Critical vulnerability blocking deployment

2. **Content Security Policy**
   - Configured in deployment build
   - Prevents XSS and injection attacks
   - Restricts resource loading

3. **HTTPS Enforcement**
   - GitHub Pages enforces HTTPS
   - Secure headers configured
   - No mixed content allowed

### Vulnerability Management

- **Critical**: Blocks deployment, immediate fix required
- **High**: Warning logged, manual review needed
- **Medium/Low**: Monitored, addressed in regular updates

## Rollback Strategy

### Automatic Rollback Triggers

- Post-deployment smoke test failures
- Critical security vulnerabilities discovered
- Performance degradation detected

### Manual Rollback Process

1. **Identify Issue**
   ```bash
   # Check deployment status
   curl -f https://username.github.io/dot-art-3d-converter/
   ```

2. **Rollback to Previous Version**
   ```bash
   # Revert commit and push
   git revert HEAD
   git push origin main
   ```

3. **Validate Rollback**
   ```bash
   # Wait for deployment to complete
   # Run smoke tests manually if needed
   ```

### Recovery Procedures

- **Build Failures**: Fix issues and re-trigger deployment
- **Test Failures**: Address failing tests before retry
- **Security Issues**: Apply security patches immediately
- **Performance Issues**: Analyze and optimize before redeployment

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# TypeScript errors
npm run typecheck
# Fix type issues and retry

# Lint errors
npm run lint:fix
# Address remaining issues manually

# Test failures
npm run test
# Fix failing tests
```

#### Deployment Issues

```bash
# Check GitHub Actions logs
# Look for specific error messages
# Verify GitHub Pages settings
# Check repository permissions
```

#### Performance Issues

```bash
# Analyze bundle size
npm run analyze-bundle

# Check for large dependencies
npm run build:analyze

# Run performance audit
npm run perf-audit
```

### Debug Commands

```bash
# Local development
npm run dev

# Production preview
npm run preview

# Test build locally
npm run build && npm run preview

# Check bundle composition
npm run analyze-bundle

# Run all tests
npm run test:all
```

## Monitoring and Alerts

### Health Checks

- **Automated**: Post-deployment smoke tests
- **Manual**: Regular production validation
- **Scheduled**: Weekly performance audits

### Metrics Collection

- Deployment success/failure rates
- Build time trends
- Bundle size progression
- Test coverage metrics
- Security vulnerability counts

### Alert Conditions

- Deployment failures
- Critical security vulnerabilities
- Performance regression > 20%
- Test coverage drops below 80%
- Bundle size exceeds limits

## Maintenance

### Regular Tasks

#### Daily
- Monitor deployment status
- Review automated test results
- Check security alerts

#### Weekly
- Review performance metrics
- Update dependencies
- Analyze bundle composition

#### Monthly
- Security audit review
- Performance optimization review
- CI/CD pipeline maintenance

### Dependency Updates

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Run tests
npm run test:all

# Deploy with confidence
git push origin main
```

## Best Practices

### Development Workflow

1. **Feature branches**: Develop features in separate branches
2. **Pull requests**: Required for all changes to main
3. **Code review**: Peer review before merge
4. **Testing**: Comprehensive test coverage required
5. **Documentation**: Update docs with changes

### Deployment Practices

1. **Small, frequent deployments**: Easier to debug and rollback
2. **Feature flags**: For gradual feature rollouts
3. **Monitoring**: Watch metrics after deployment
4. **Communication**: Notify team of significant deployments

### Performance Optimization

1. **Bundle analysis**: Regular review of bundle composition
2. **Code splitting**: Lazy load non-critical components
3. **Caching strategies**: Leverage browser and CDN caching
4. **Monitoring**: Track Core Web Vitals

---

## Quick Reference

### Deployment Status
- **URL**: https://username.github.io/dot-art-3d-converter/
- **Status**: Check GitHub Actions tab
- **Logs**: GitHub Actions workflow logs

### Emergency Contacts
- **Repository**: https://github.com/username/dot-art-3d-converter
- **Issues**: https://github.com/username/dot-art-3d-converter/issues
- **Actions**: https://github.com/username/dot-art-3d-converter/actions

### Key Commands
```bash
# Local development
npm run dev

# Production build
npm run build

# Test everything
npm run test:all

# Analyze performance
npm run optimize

# Deploy (push to main)
git push origin main
```