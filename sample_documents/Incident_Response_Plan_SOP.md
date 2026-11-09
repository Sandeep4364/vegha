# Standard Operating Procedure: Incident Response Plan (SOP-SEC-012)

**Organization:** Global Enterprise Systems Corp  
**Document ID:** SOP-SEC-012  
**Version:** 3.8  
**Effective Date:** February 1, 2026  
**Review Cycle:** Annual  
**Owner:** Director of Security Operations (SecOps)  

---

## 1. Overview and Objectives
This Standard Operating Procedure (SOP) governs the identification, triage, containment, eradication, recovery, and post-mortem review of potential cybersecurity events, data breaches, and infrastructure disruptions.

The primary objectives are:
1. Rapidly contain threats to protect customer confidential data.
2. Comply with mandatory statutory notification requirements (e.g., GDPR 72-hour notification, HIPAA breach notification, state privacy laws).
3. Preserve digital forensic evidence in accordance with legal chain-of-custody standards.

---

## 2. Incident Classification & Severity Levels

Every declared security incident is assigned a severity tier by the Incident Commander (IC):

| Severity | Definition | Initial Response SLA | Status Update Cadence |
|---|---|---|---|
| **SEV-1 (Critical)** | Active data exfiltration, ransomware attack, widespread production outage, or compromised root credentials. | **15 minutes** | Every 30 minutes to Executive Leadership |
| **SEV-2 (High)** | Compromised employee account with elevated privilege, localized malware on corporate network, DDoS impacting secondary services. | **30 minutes** | Every 2 hours |
| **SEV-3 (Medium)** | Suspicious phishing campaign detected without verified credential entry, isolated host alert without lateral movement. | **2 hours** | Daily update |
| **SEV-4 (Low)** | Informational alerts, port scanning against exterior perimeter without exploit attempts, benign policy deviations. | **24 hours** | Weekly digest |

---

## 3. Incident Response Lifecycle Phases

### Phase 1: Detection & Triage
- Alerts originate from the Cloud SIEM (Datadog/Wazuh), AWS GuardDuty, CrowdStrike Falcon EDR, or employee reports to `security-incident@company.com`.
- On-duty SOC analyst investigates indicators of compromise (IOCs) within the response SLA.
- If verified, the analyst escalates to the designated on-call Incident Commander via PagerDuty.

### Phase 2: Containment Strategies
Containment must be executed immediately to prevent lateral spread:
1. **Network Isolation:** Automatically detach compromised EC2/GCE virtual machines from production VPC security groups and attach to an isolated forensic subnet (`sg-quarantine`).
2. **Session Revocation:** For compromised user accounts, the Incident Commander must trigger an immediate global session token invalidation in Okta and revoke active AWS STS sessions via CLI.
3. **API Key Invalidation:** Revoke compromised API keys, rotate affected database master credentials, and invalidate exposed OAuth tokens.

### Phase 3: Eradication & Remediation
- Rebuild compromised containers or virtual machines from certified gold-master base images.
- Close exploited firewall ports or security group ingress rules.
- Deploy signature updates across all EDR endpoints.
- Verify through vulnerability scanning that the exploitation vector has been completely eliminated.

### Phase 4: Recovery & Verification
- Restore service nodes following health validation checks.
- Conduct continuous enhanced monitoring of affected system logs for a minimum of 48 hours following service restoration.
- Validate data integrity by running cryptographic checksum comparisons against recent verified backups.

### Phase 5: Post-Incident Review & Root Cause Analysis (RCA)
- For all SEV-1 and SEV-2 incidents, a mandatory blameless Post-Mortem meeting must be convened within **5 business days** of incident closure.
- The Incident Commander must produce a formal Root Cause Analysis (RCA) document documenting:
  - Incident timeline and detection latency.
  - Root cause mechanism (e.g., missing patch, configuration drift, phishing).
  - Action items with assigned owners and 30-day completion deadlines.

---

## 4. Statutory & Regulatory Breach Notification Timelines

### 4.1 GDPR Article 33 (European Economic Area)
If an incident involves confirmed personal data breach affecting EU data subjects:
- The Data Protection Officer (DPO) and Legal Counsel must notify the relevant Lead Supervisory Authority within **72 hours** of becoming aware of the breach.
- Affected data subjects must be informed without undue delay if the breach presents a high risk to individual rights and freedoms.

### 4.2 Customer Contractual SLA Notifications
- If customer dedicated tenant data or encryption keys are impacted, customer notification must occur within **24 hours** of incident confirmation, accompanied by an initial impact assessment.
- Written preliminary breach reports must be furnished within **5 calendar days**.

---

## 5. Tabletop Drills & SOP Testing
- The Incident Response Team must execute a simulated Tabletop Exercise (TTX) at least **twice per year** (semi-annually).
- Scenarios must include simulated ransomware, insider data theft, and cloud IAM credential leakage.
- Drill evaluations and remediation tracking must be archived for external SOC 2 and ISO 27001 auditor examination.
