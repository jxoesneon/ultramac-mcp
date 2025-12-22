# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them responsibly:

### Reporting Process

1. **Email**: (To be configured - use GitHub Security Advisories for now)
2. **GitHub Security Advisories**: https://github.com/jxoesneon/ultramac-mcp/security/advisories/new
3. **Provide**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Timeline**: Critical issues within 14 days, others within 30 days
- **Disclosure**: Coordinated disclosure after fix is released

### Rewards

Currently no bug bounty program, but:

- Public acknowledgment in CHANGELOG
- Listed in SECURITY.md contributors
- Our eternal gratitude 🙏

## Security Measures

### Already Implemented ✅

1. **Authentication**

   - API key validation
   - Rate limiting (10 req/sec)
   - Client identification

2. **Input Sanitization**

   - Command whitelist
   - Path validation
   - Shell metacharacter removal

3. **Audit Logging**

   - All tool invocations logged
   - Security events tracked
   - 30-day retention

4. **Dependency Security**

   - Automated Dependabot scans
   - GitHub Actions security checks
   - Zero known vulnerabilities

5. **Container Security**
   - Non-root user
   - Read-only filesystem
   - no-new-privileges flag
   - Resource limits

### Known Limitations ⚠️

1. **Local Access Required**

   - Server must run on machine being automated
   - No remote access protections (by design)

2. **Screenshot Security**

   - Screenshots saved to /tmp (world-readable on some systems)
   - Recommendation: Use encrypted filesystem

3. **Action History**

   - Encrypted at rest using AES-256-GCM
   - Stored in secure `~/.ultramac-mcp/history` directory
   - 7-day automated retention policy

4. **No Built-in HTTPS**
   - HTTP transport not encrypted
   - Recommendation: Use reverse proxy (nginx, Caddy)

## Security Best Practices

### For Administrators

1. **API Keys**

   - Generate strong keys: `openssl rand -hex 32`
   - Rotate every 90 days
   - Never commit to version control
   - Use environment variables

2. **Filesystem**

   - Enable FileVault (macOS)
   - Restrict directory permissions (0o700)
   - Regularly review audit logs

3. **Network**

   - Use HTTPS reverse proxy
   - Firewall rules (allow only necessary IPs)
   - VPN for remote access

4. **Monitoring**

   - Set up Prometheus alerts
   - Monitor audit logs daily
   - Track authentication failures

5. **Updates**
   - Enable Dependabot
   - Review security advisories weekly
   - Apply patches promptly

### For Developers

1. **Code Review**

   - All PRs require review
   - Security-sensitive changes need extra scrutiny
   - Run `npm audit` before committing

2. **Testing**

   - Maintain 95%+ test coverage
   - Include security tests
   - Test input sanitization

3. **Dependencies**
   - Minimize dependencies
   - Review new dependencies
   - Monitor for vulnerabilities

## Security Audits

### Internal Audits

- **Frequency**: Quarterly
- **Scope**: Code review, dependency check, penetration testing
- **Last Audit**: 2025-12-22

### External Audits

- Not yet conducted
- Open to security researchers
- Contact us for collaboration

## Vulnerability Disclosure Policy

### Disclosure Timeline

1. **T+0**: Vulnerability reported
2. **T+48h**: Acknowledged
3. **T+7d**: Assessed and prioritized
4. **T+14-30d**: Fix developed and tested
5. **T+Release**: Security patch released
6. **T+Release+7d**: Public disclosure

### Public Disclosure

After fix is released:

- CVE assigned (if applicable)
- GitHub Security Advisory published
- CHANGELOG updated
- Blog post (for critical issues)

## Security Checklist for Deployments

- [ ] Strong API key configured
- [ ] Filesystem encryption enabled
- [ ] HTTPS reverse proxy (if using HTTP transport)
- [ ] Firewall rules configured
- [ ] Monitoring and alerting set up
- [ ] Audit logs reviewed regularly
- [ ] Dependencies up to date
- [ ] Container security options enabled
- [ ] Regular backups configured
- [ ] Incident response plan in place

## Incident Response

### In Case of Security Incident

1. **Contain**: Stop the service immediately
2. **Assess**: Review audit logs
3. **Notify**: Report to administrators
4. **Remediate**: Apply fixes
5. **Learn**: Update security measures

### Post-Incident

- Root cause analysis
- Update security documentation
- Inform affected users
- Improve monitoring

## Compliance

### Standards

- ✅ OWASP Top 10 (2021)
- ✅ CWE/SANS Top 25
- ✅ NIST Cybersecurity Framework (Core)

### Certifications

- None currently
- Open to pursuing if needed

## Additional Resources

- [OWASP MCP Security Guide](https://modelcontextprotocol.io/security) (when available)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Bun Security](https://bun.sh/docs/runtime/security)

## Contact

- **Security Issues**: GitHub Security Advisories
- **General Security Questions**: GitHub Issues (tag: security)
- **email**: (To be configured)

---

**Last Updated**: 2025-12-22  
**Policy Version**: 1.0.0
