# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it privately:

### Email Security Report

Send an email to: **security@liminal.example.com** (replace with actual security contact)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Initial Assessment**: We'll provide an initial assessment within 7 days
- **Updates**: We'll keep you informed of progress
- **Resolution**: We'll work to resolve critical issues promptly

### Disclosure Policy

- We follow **responsible disclosure** practices
- Vulnerabilities will be disclosed after a fix is available
- Credit will be given to reporters (if desired)
- Public disclosure timeline: typically 90 days after fix

## Security Best Practices

### For Users

1. **Always use TLS/WSS**: LTP should always run over secure connections
   ```javascript
   // ✅ Good
   const client = new LtpClient('wss://example.com');
   
   // ❌ Bad
   const client = new LtpClient('ws://example.com');
   ```

2. **Validate Server Certificates**: Ensure proper certificate validation
3. **Keep SDKs Updated**: Use the latest SDK versions
4. **Secure Storage**: Protect thread_id/session_id storage
5. **Validate Inputs**: Always validate data before sending

### For Developers

1. **Never Commit Secrets**: Use environment variables
2. **Review Dependencies**: Regularly update dependencies
3. **Follow Protocol Spec**: Implement protocol correctly
4. **Test Security**: Include security tests
5. **Document Security**: Document security considerations

## Known Security Considerations

### Current Limitations (v0.3)

- **Signature Placeholder**: Current `signature` field is a placeholder
  - Real cryptographic signatures planned for v0.4+
  - **Mitigation**: Always use TLS/WSS until signatures are implemented

- **Nonce Generation**: Uses cryptographically secure random
  - ✅ Safe for current use case
  - Future: May add additional entropy sources

- **Storage**: Thread/session IDs stored in local storage
  - ✅ Acceptable for current use case
  - Future: May add encrypted storage options

### Protocol Security

- **Transport Security**: LTP requires TLS/WSS in production
- **Message Integrity**: Nonce + signature (v0.4+) provide integrity
- **Replay Protection**: Nonce + timestamp prevent replay attacks
- **Session Management**: Thread/session IDs enable session continuity

## Security Updates

Security updates will be:
- Released promptly for critical issues
- Documented in CHANGELOG.md
- Tagged with security advisories
- Communicated to users via releases

## Security Checklist

When implementing LTP:

- [ ] Use WSS (not WS) in production
- [ ] Validate server certificates
- [ ] Secure thread/session ID storage
- [ ] Implement proper error handling
- [ ] Use latest SDK version
- [ ] Review security advisories
- [ ] Test with security tools
- [ ] Follow deployment security guide

## Resources

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Security deployment practices
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Security architecture overview
- [Protocol Specs](./specs/) - Detailed protocol security considerations

Thank you for helping keep LTP secure! 🔒

