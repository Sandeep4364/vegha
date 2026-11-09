# Global Data Retention & Privacy Policy (POL-PRIV-007)

**Organization:** Global Enterprise Systems Corp  
**Version:** 3.1  
**Effective Date:** January 10, 2026  
**Regulatory Baselines:** GDPR, CCPA/CPRA, HIPAA Privacy Rule, SOC 2 Privacy Criteria  
**Owner:** Global Data Protection Officer (DPO)  

---

## 1. Principles of Data Processing
Global Enterprise Systems Corp adheres strictly to the principles of purpose limitation, data minimization, accuracy, storage limitation, integrity, confidentiality, and accountability across all customer and internal records.

---

## 2. Retention Schedules by Data Category

| Record Type | Retention Duration | Disposal / Anonymization Method | Legal Basis |
|---|---|---|---|
| **Customer Transaction Records** | 7 years from transaction date | Automated cryptographic deletion | Financial regulatory & tax statutes |
| **User Activity & Access Logs** | 1 year (365 days) | Automatic S3 lifecycle transition to Glacier Deep Archive, purge after 365 days | SOC 2 Trust Services Criteria & ISO 27001 |
| **System Audit Trails** | 2 years (730 days) | WORM storage (Object Lock compliance mode) | Security incident reconstruction |
| **Customer Support Recordings** | 90 calendar days | Permanent deletion | Quality assurance limitation |
| **Marketing Inquiries / Leads** | 180 days without activity | Purged from CRM | Consent expiration |

---

## 3. Data Subject Rights & Erasure Procedure (Right to Be Forgotten)

### 3.1 Verification & Ingestion
- Privacy requests received via `privacy@company.com` or customer portal API endpoints are assigned a tracking token and verified against the user's primary MFA credential.

### 3.2 30-Day Erasure SLA
- All verified Right to Erasure (GDPR Art. 17) requests must be fully fulfilled across both primary datastores (PostgreSQL, MongoDB) and secondary search indexes (Elasticsearch) within **30 calendar days**.
- Where data must be retained for legal compliance (e.g., invoices), personal identifiers must be permanently pseudonymized using irreversible SHA-256 HMAC salts.

---

## 4. International Data Transfers
- Any cross-border transfers of EU personal data to third countries without an adequacy decision must incorporate the European Commission's approved Standard Contractual Clauses (SCCs).
- Technical Transfer Impact Assessments (TIAs) must be reviewed every 12 months for all overseas vendors.
