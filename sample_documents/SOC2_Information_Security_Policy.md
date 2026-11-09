# Enterprise Information Security Policy (POL-SEC-001)

**Organization:** Global Enterprise Systems Corp  
**Version:** 4.2  
**Effective Date:** January 15, 2026  
**Classification:** Internal & Confidential  
**Owner:** Chief Information Security Officer (CISO)  
**Approved By:** Executive Risk Committee  

---

## 1. Purpose & Scope
This policy defines mandatory information security governance, control baselines, and operational safeguards to protect corporate information assets, customer data, and cloud infrastructure in compliance with **SOC 2 Type II (Trust Services Criteria)**, **ISO/IEC 27001:2022**, and applicable global data protection regulations.

This policy applies to all full-time employees, contractors, third-party vendors, cloud infrastructure accounts (AWS, GCP, Azure), corporate networks, and SaaS systems holding Company Data.

---

## 2. Information Classification & Handling
Company information is categorized into four distinct classification tiers:

1. **Public:** Information intended for public distribution (marketing sheets, public documentation).
2. **Internal:** Day-to-day business communication, internal wikis, operational memos.
3. **Confidential:** Customer transaction data, employee PII, contracts, financial projections, proprietary source code.
4. **Restricted:** Production cryptographic keys, database master credentials, audit logs, and highly sensitive customer secrets.

### 2.1 Handling & Cryptographic Safeguards
- All **Confidential** and **Restricted** data stored at rest must be encrypted using industry-standard **AES-256** or equivalent certified cryptographic modules (FIPS 140-3 validated).
- All data in transit across public networks or untrusted internal segments must enforce **TLS 1.3** (or minimum TLS 1.2 with perfect forward secrecy ciphers). Unencrypted plain-text protocols (HTTP, FTP, Telnet) are strictly banned.
- Database volumes, object storage buckets (S3/GCS), and backup snapshots must have server-side encryption enabled by default upon creation.

---

## 3. Identity and Access Management (IAM)

### 3.1 Principle of Least Privilege
Access to enterprise systems, production databases, and cloud control planes must be granted on a strict **need-to-know and least privilege** basis. Default access across all corporate systems is deny-all.

### 3.2 Multi-Factor Authentication (MFA)
- Multi-Factor Authentication (MFA) is strictly mandatory for:
  - All employee identity provider logins (Okta / Google Workspace).
  - All access to production cloud environments, Kubernetes clusters, and bastion jump hosts.
  - Remote VPN access and developer code repositories.
- Permitted MFA factors include FIDO2 WebAuthn hardware security keys (e.g., YubiKey) and time-based one-time password (TOTP) authenticator applications. SMS-based MFA is prohibited for privileged accounts.

### 3.3 Password Complexity & Lifecycle
- Minimum password length is 14 characters, combining uppercase, lowercase, numbers, and special symbols.
- Passwords must not match previous 10 passwords.
- Passwords expire every 90 days for administrative accounts unless passwordless FIDO2 biometric authentication is active.

### 3.4 Quarterly Access Reviews
The Security Operations team in conjunction with department leads must conduct a comprehensive **Quarterly Access Review** (every 90 days) covering:
- AWS/GCP IAM roles and service accounts.
- Production database privileges and read-replica access.
- Code repository administration rights.
Any unneeded, orphaned, or dormant accounts (inactive > 45 days) must be revoked within 24 hours of identification.

---

## 4. Personnel Security & Offboarding

### 4.1 Background Checks
All prospective employees, contractors, and long-term consultants with potential access to production systems or confidential data must successfully pass a criminal history background check, employment verification, and identity check prior to being granted system credentials.

### 4.2 Security Awareness Training
- All new hires must complete formal security awareness training within 14 calendar days of employment.
- Annual refresher training is mandatory for all active staff, including simulated phishing resilience tests.

### 4.3 Employee Offboarding & Credential Revocation
Upon notice of employee termination (voluntary or involuntary):
- HR must notify the IT Security Helpdesk at least 24 hours prior to scheduled departure, or immediately for involuntary departures.
- All corporate accounts, Single Sign-On (SSO) credentials, VPN tunnels, and cloud tokens must be disabled within **4 hours** of the employee's official departure timestamp.
- All company-issued hardware assets (laptops, security keys, mobile devices) must be recovered, verified, and wiped according to NIST SP 800-88 guidelines.

---

## 5. Vulnerability Management & Patching

### 5.1 Scanning Frequency
- Automated internal and external vulnerability scans must run on a weekly schedule against all public IP ranges, web applications, and container registries.
- Third-party penetration testing must be performed at least annually by an independent CREST-certified cybersecurity consultancy.

### 5.2 Patch Remediation Timelines (SLA)
Identified Common Vulnerabilities and Exposures (CVEs) must be remediated according to CVSS v3.x severity:
- **Critical (CVSS 9.0 - 10.0):** Patch or mitigating control must be deployed within **48 hours**.
- **High (CVSS 7.0 - 8.9):** Patch must be deployed within **14 calendar days**.
- **Medium (CVSS 4.0 - 6.9):** Patch must be deployed within **30 calendar days**.
- **Low (CVSS 0.1 - 3.9):** Patch addressed during the next scheduled quarterly release cycle.

---

## 6. Business Continuity & Disaster Recovery (BC/DR)
- System backups for relational production databases must be captured continuously (point-in-time recovery) and stored in a geographically isolated secondary region.
- Recovery Time Objective (RTO) for tier-1 customer-facing services is **4 hours**.
- Recovery Point Objective (RPO) is **1 hour**.
- The Business Continuity Plan must undergo an end-to-end simulated failover exercise at least once every 12 months, with results submitted to the Board Risk Committee.

---

## 7. Policy Enforcement & Non-Compliance
Failure to comply with this policy may result in disciplinary action up to and including termination of employment, revocation of contracts, and legal prosecution for intentional breaches or gross negligence.
