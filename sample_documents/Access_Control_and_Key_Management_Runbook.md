# Engineering Runbook: Access Control & Key Management (RB-ENG-044)

**Organization:** Global Enterprise Systems Corp  
**System:** Cloud Infrastructure & Key Management Service (KMS)  
**Version:** 2.5  
**Effective Date:** January 20, 2026  
**Audience:** Cloud Engineers, DevOps, Site Reliability Engineers (SRE)  

---

## 1. Scope and Architecture
This technical runbook specifies the step-by-step procedures for administering IAM privileges, rotating cryptographic keys, managing SSH certificates, and securing production secrets.

### 1.1 Key Architecture Principles
- Zero Standing Privileges: Developers do not hold persistent write access to production AWS/GCP accounts. Access is granted just-in-time (JIT) via approved change requests for a maximum 4-hour window.
- Envelope Encryption: Data keys (DEKs) are generated per document/record and protected under Customer Managed Keys (CMKs) hosted in Hardware Security Modules (AWS KMS / Cloud KMS).

---

## 2. Cryptographic Key Management Lifecycle

### 2.1 Key Creation & Parameters
- Master encryption keys must be generated within FIPS 140-3 Level 3 validated Cloud KMS HSMs.
- Symmetric encryption keys must utilize **AES-256-GCM**.
- Asymmetric signing keys must utilize **ECDSA (NIST P-384)** or **RSA-4096**. RSA keys below 2048 bits are rejected by policy.

### 2.2 Key Rotation Procedures
1. **Automatic Annual Rotation:** All KMS Customer Managed Keys (CMKs) must have automatic annual rotation enabled (`EnableKeyRotation: true`). Rotation occurs every 365 calendar days.
2. **Emergency Key Rotation (Compromise Protocol):**
   - Step 1: Disable the compromised KMS key immediately via CLI:
     ```bash
     aws kms disable-key --key-id <KEY_ARN>
     ```
   - Step 2: Provision a new primary CMK and re-bind application aliases.
   - Step 3: Trigger batch re-encryption of data stores using the new key.
   - Step 4: Revoke all STS tokens associated with the key's usage history.

### 2.3 Secret Storage & Injection
- Hardcoded secrets, API tokens, and database passwords in source code or docker images are strictly forbidden. Git pre-commit hooks (TruffleHog / GitGuardian) block any commit containing entropy matches.
- All secrets must reside in HashiCorp Vault or AWS Secrets Manager. Secrets are injected at container startup as environment variables and rotated automatically every 60 days.

---

## 3. SSH & Bastion Access Control

### 3.1 Ephemeral SSH Certificates
- Static SSH public keys authorized in `~/.ssh/authorized_keys` are prohibited.
- Engineers authenticate to HashiCorp Vault using SSO + MFA to receive a short-lived SSH certificate valid for **8 hours**.
- Bastion hosts enforce session recording using Teleport. All terminal commands, keystrokes, and outputs are forwarded to immutable cloud storage for forensic auditing.

### 3.2 Bastion Host Hardening
- Bastion servers must be rebooted and refreshed from base AMI images weekly.
- Password authentication, X11 forwarding, and SSH root login (`PermitRootLogin no`) are permanently disabled.
