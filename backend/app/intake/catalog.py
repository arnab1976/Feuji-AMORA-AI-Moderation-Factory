"""Twelve-category modernization intake catalog.

Each category exposes five trend-based requirements plus a free-text fallback.
"""
from __future__ import annotations

from typing import Any

# Concrete nouns the LLM must weave into each category's top-5 so users recognize
# their estate (languages, databases, document types, platforms, etc.).
CATEGORY_EXAMPLES: dict[str, str] = {
    "legacy_source": (
        "Name real languages / estates in every option, e.g. COBOL, PL/I, Fortran, "
        "Assembler, RPG, Natural/Adabas, Java EE, .NET Framework, VB6, PowerBuilder, "
        "mainframe PDS/PDSE, copybooks, CICS programs."
    ),
    "database": (
        "Name real stores in every option, e.g. DB2, Oracle, VSAM, IMS DB, IDMS, "
        "SQL Server, Sybase, Informix, PostgreSQL target, MongoDB, flat files, "
        "hierarchical / network models."
    ),
    "configuration": (
        "Name real config artifacts, e.g. JCL, PROC, CICS tables, PARMLIB, .ini/.xml/.properties, "
        "WebSphere/WebLogic configs, feature flags, vault secrets, environment overlays."
    ),
    "interfaces": (
        "Name real channels, e.g. IBM MQ, SOAP, REST, 3270, EDI/X12, file NDM/Connect:Direct, "
        "Kafka, Event Hubs, FTP/SFTP batch, partner APIs."
    ),
    "business_docs": (
        "Name real document types, e.g. BRD/FRD, SOP runbooks, decision tables, policy manuals, "
        "claims guidelines, pricing matrices, Word/PDF/Excel rule books, Confluence/SharePoint."
    ),
    "transactions": (
        "Name real workload examples, e.g. account balance inquiry, payment posting, "
        "claims adjudication, overnight batch cycles, ATM/POS authorizations, ledger closes."
    ),
    "observability": (
        "Name real signals/tools, e.g. SMF, RMF, Syslog, Splunk, ELK, OpenTelemetry, "
        "job logs, CICS monitoring, APM traces, correlation IDs."
    ),
    "tests": (
        "Name real test assets, e.g. COBOL unit/regression suites, Selenium UAT scripts, "
        "JUnit/NUnit, mainframe compare utilities, golden master files, contract tests."
    ),
    "defects": (
        "Name real sources, e.g. ServiceNow, Jira, ChangeMan, incident bridges, "
        "P1 outage history, SOX finding logs, change tickets."
    ),
    "build_deploy": (
        "Name real platforms, e.g. Jenkins, Azure DevOps, GitHub Actions, Control-M, CA-7, "
        "Endevor, Changeman, Kubernetes, OpenShift, Terraform, Ansible."
    ),
    "security": (
        "Name real controls, e.g. RACF/ACF2/Top Secret, Active Directory, SOX, PCI-DSS, "
        "GDPR, vault/KMS, privileged access, SBOM scanning."
    ),
    "target_state": (
        "Name real target patterns, e.g. cloud-native microservices on AWS/Azure/GCP, "
        "modular monolith on Java/.NET, Kafka event core, Kubernetes, managed Postgres, "
        "API gateway + BFF."
    ),
}

INTAKE_CATEGORIES: list[dict[str, Any]] = [
    {
        "id": "legacy_source",
        "name": "1. Legacy source-code data",
        "summary": "How source is held, versioned, and read for modernization.",
        "strategic_importance": "Primary Baseline: COBOL, Fortran, SAS, Assembler, PL/I, Java EE source files containing the foundational legacy logic.",
        "examples": CATEGORY_EXAMPLES["legacy_source"],
        "options": [
            {"id": "monorepo_cobol", "label": "Inventory COBOL / PL/I / copybook estates into a versioned monorepo"},
            {"id": "pds_mainframe", "label": "Extract mainframe PDS/PDSE libraries (COBOL, Assembler, JCL) with dependency maps"},
            {"id": "java_ee_monolith", "label": "Map Java EE / .NET Framework / VB6 monoliths with module boundaries"},
            {"id": "hybrid_stack", "label": "Unify hybrid stacks (COBOL batch + CICS online + shared copybooks)"},
            {"id": "dark_code", "label": "Find dark/orphaned Fortran, RPG, or Natural code for elimination"},
        ],
    },
    {
        "id": "target_state",
        "name": "2. Target-state requirements",
        "summary": "Where the estate should land and what success looks like.",
        "strategic_importance": "Strategic Destination: Cloud-native microservices, target frameworks, event-driven core specs, and architectural objectives.",
        "examples": CATEGORY_EXAMPLES["target_state"],
        "options": [
            {"id": "cloud_native", "label": "Land on cloud-native Java/.NET microservices with managed Postgres"},
            {"id": "modular_monolith", "label": "Start with a modular monolith, extract payment hot paths later"},
            {"id": "event_driven", "label": "Event-driven core on Kafka with clear bounded contexts"},
            {"id": "low_code_hybrid", "label": "Hybrid low-code + custom APIs for faster channel delivery"},
            {"id": "multi_cloud", "label": "Multi-cloud ready runtime (AWS/Azure/GCP) with portable contracts"},
        ],
    },
    {
        "id": "database",
        "name": "3. Database and data-structure inputs",
        "summary": "Schemas, stores, and data contracts that must move safely.",
        "strategic_importance": "Data Architecture: DB2, Oracle, VSAM, SAS datasets, relational schemas, and data migration models.",
        "examples": CATEGORY_EXAMPLES["database"],
        "options": [
            {"id": "db2_oracle_cutover", "label": "Modernize DB2 / Oracle schemas with dual-write cutover"},
            {"id": "vsam_to_rdbms", "label": "Migrate VSAM / IMS / flat files to relational or document stores"},
            {"id": "cdc_streaming", "label": "Add CDC from DB2/Oracle to Kafka / Event Hubs for near-real-time sync"},
            {"id": "canonical_model", "label": "Build a canonical model across DB2, Oracle, and SQL Server domains"},
            {"id": "pii_tokenization", "label": "Tokenize PII fields in customer/claims tables before rewrite"},
        ],
    },
    {
        "id": "business_docs",
        "name": "4. Business documentation",
        "summary": "Rules, SOPs, and SME knowledge that agents must respect.",
        "strategic_importance": "Domain Rules: Business Requirement Documents (BRD), policy manuals, SOP runbooks, and DMN decision tables.",
        "examples": CATEGORY_EXAMPLES["business_docs"],
        "options": [
            {"id": "living_br_catalog", "label": "Extract living rules from BRDs, PDFs, and COBOL comments into a catalog"},
            {"id": "decision_tables", "label": "Capture pricing/eligibility/claims as DMN decision tables from Excel"},
            {"id": "runbook_digitize", "label": "Digitize Word/SharePoint SOP runbooks and exception playbooks"},
            {"id": "process_mining", "label": "Validate documented claims/payment flows with process-mining traces"},
            {"id": "sme_capture", "label": "Structure SME interviews on policy manuals with traceability IDs"},
        ],
    },
    {
        "id": "interfaces",
        "name": "5. Interface and integration data",
        "summary": "How this system talks to partners and internal services.",
        "strategic_importance": "System Integration: IBM MQ, SOAP/REST APIs, CICS copybooks, batch files, and middleware contracts.",
        "examples": CATEGORY_EXAMPLES["interfaces"],
        "options": [
            {"id": "api_facade", "label": "API facade over IBM MQ / SOAP / 3270 with strangler slices"},
            {"id": "event_mesh", "label": "Replace point-to-point MQ with Kafka / Event Hubs mesh"},
            {"id": "bff_contracts", "label": "Publish OpenAPI / AsyncAPI contracts for partner REST and EDI"},
            {"id": "file_batch_modern", "label": "Modernize NDM / SFTP batch files to managed transfer + schemas"},
            {"id": "partner_versioning", "label": "Version partner SOAP/EDI interfaces with deprecation windows"},
        ],
    },
    {
        "id": "security",
        "name": "6. Security and compliance data",
        "summary": "Controls that cannot be weakened during the rewrite.",
        "strategic_importance": "Governance & Safeguards: OWASP, NIST, SOX, PCI-DSS, GDPR, PII tokenization, and RACF/IAM access policies.",
        "examples": CATEGORY_EXAMPLES["security"],
        "options": [
            {"id": "zero_trust", "label": "Map RACF/ACF2 identities to zero-trust cloud service accounts"},
            {"id": "sox_pci_controls", "label": "Preserve SOX / PCI-DSS control mapping in the new design"},
            {"id": "data_residency", "label": "Enforce GDPR/residency rules for customer data in target stores"},
            {"id": "sbom_scanning", "label": "Add SBOM + vulnerability scanning in the CI pipeline"},
            {"id": "privileged_access", "label": "Review privileged access for mainframe and cloud admins"},
        ],
    },
    {
        "id": "transactions",
        "name": "7. Production transaction data",
        "summary": "Real workloads used for equivalence and rehearsal.",
        "strategic_importance": "Equivalence Verification: Live transaction feeds, execution workloads, and production replay datasets.",
        "examples": CATEGORY_EXAMPLES["transactions"],
        "options": [
            {"id": "anon_replay", "label": "Anonymized balance-inquiry / payment-posting replay for equivalence"},
            {"id": "golden_journeys", "label": "Golden journeys for ATM, online banking, and claims adjudication"},
            {"id": "synthetic_scale", "label": "Synthetic volume matching month-end and overnight batch peaks"},
            {"id": "ledger_balancing", "label": "Ledger-close balancing checks on every old-vs-new replay"},
            {"id": "shadow_traffic", "label": "Shadow production authorizations into the new payment stack"},
        ],
    },
    {
        "id": "tests",
        "name": "8. Existing test assets",
        "summary": "What already proves correctness — and what must be rebuilt.",
        "strategic_importance": "Validation Safety Net: Test suites, characterization cases, regression scripts, and golden master harnesses.",
        "examples": CATEGORY_EXAMPLES["tests"],
        "options": [
            {"id": "characterization", "label": "Characterization tests from COBOL / Java legacy behavior"},
            {"id": "contract_suite", "label": "Contract + integration suite for MQ and REST as the safety net"},
            {"id": "uat_automation", "label": "Automate Excel/Selenium UAT scripts into business-readable cases"},
            {"id": "mutation_guard", "label": "Property/mutation tests on money paths (payments, ledger)"},
            {"id": "parity_harness", "label": "Old-vs-new parity harness using golden master files as a gate"},
        ],
    },
    {
        "id": "build_deploy",
        "name": "9. Build, deployment and infrastructure data",
        "summary": "How builds ship today and how the target should ship.",
        "strategic_importance": "Delivery Pipeline: CI/CD pipelines, Docker/Kubernetes containers, Terraform IaC, and batch schedulers.",
        "examples": CATEGORY_EXAMPLES["build_deploy"],
        "options": [
            {"id": "cicd_platforms", "label": "Replace Endevor/Changeman promotes with Jenkins / Azure DevOps CI/CD"},
            {"id": "container_platform", "label": "Deploy target services on Kubernetes / OpenShift with canary"},
            {"id": "iac_envs", "label": "Terraform / Ansible IaC for reproducible test and prod envs"},
            {"id": "scheduler_modern", "label": "Modernize Control-M / CA-7 workloads onto cloud schedulers"},
            {"id": "gitops", "label": "GitOps promotion with signed artifacts from GitHub Actions"},
        ],
    },
    {
        "id": "configuration",
        "name": "10. Application configuration data",
        "summary": "Runtime knobs, feature flags, and environment parity.",
        "strategic_importance": "Runtime Knobs: Config-as-code overlays, PARMLIB parameters, environment settings, and feature flags.",
        "examples": CATEGORY_EXAMPLES["configuration"],
        "options": [
            {"id": "config_as_code", "label": "Convert .xml/.properties/PARMLIB knobs into config-as-code overlays"},
            {"id": "secrets_vault", "label": "Move dataset/file secrets into Vault / KMS (replace hardcoded keys)"},
            {"id": "feature_flags", "label": "Introduce feature flags for COBOL-to-service progressive toggles"},
            {"id": "jcl_proc_inventory", "label": "Inventory JCL / PROC / CICS tables with owners and environments"},
            {"id": "policy_driven", "label": "Policy-driven WebSphere/WebLogic config with audited diffs"},
        ],
    },
    {
        "id": "observability",
        "name": "11. Runtime logs and observability data",
        "summary": "Signals needed to compare old vs new safely.",
        "strategic_importance": "Telemetry & Signals: Splunk/ELK logs, OpenTelemetry traces, SMF/RMF metrics, and APM operational logs.",
        "examples": CATEGORY_EXAMPLES["observability"],
        "options": [
            {"id": "unified_otel", "label": "Unify SMF/CICS and cloud APM into OpenTelemetry traces"},
            {"id": "sli_slo", "label": "SLI/SLO dashboards (Splunk/ELK) tied to modernization gates"},
            {"id": "batch_job_telemetry", "label": "Batch job telemetry from Control-M / CA-7 with failure taxonomy"},
            {"id": "corr_ids", "label": "Correlation IDs spanning MQ, REST APIs, and DB2/Oracle"},
            {"id": "anomaly_baselines", "label": "Anomaly baselines from Syslog/SMF before cutover windows"},
        ],
    },
    {
        "id": "defects",
        "name": "12. Defect, incident and change-history data",
        "summary": "History that reveals risk hotspots and change patterns.",
        "strategic_importance": "Historical Analytics: ServiceNow/JIRA defect logs, P1 incident bridges, change-fail history, and maintenance tickets.",
        "examples": CATEGORY_EXAMPLES["defects"],
        "options": [
            {"id": "hotspot_mining", "label": "Mine ServiceNow/Jira defects to prioritize COBOL strangler slices"},
            {"id": "change_fail_rate", "label": "Baseline change-fail rate / MTTR from ChangeMan and cloud deploys"},
            {"id": "incident_taxonomy", "label": "Map P1 incident bridges to modernization risk themes"},
            {"id": "reg_change_log", "label": "Link SOX/audit findings to business rules under rewrite"},
            {"id": "tech_debt_backlog", "label": "Score tech-debt tickets by blast radius across modules"},
        ],
    },
]


def catalog_payload(*, include_options: bool = True) -> dict[str, Any]:
    """Return a copy of the catalog so API handlers never mutate shared state."""
    categories: list[dict[str, Any]] = []
    for cat in INTAKE_CATEGORIES:
        row = {
            "id": cat["id"],
            "name": cat["name"],
            "summary": cat["summary"],
            "examples": cat.get("examples", ""),
            "options": (
                [{"id": o["id"], "label": o["label"]} for o in cat.get("options", [])]
                if include_options
                else []
            ),
        }
        categories.append(row)
    return {
        "categories": categories,
        "count": len(categories),
        "options_per_category": 5,
    }


def resolve_selection(category_id: str, choice_id: str | None, custom_text: str | None) -> str:
    if custom_text and custom_text.strip():
        return custom_text.strip()
    for cat in INTAKE_CATEGORIES:
        if cat["id"] != category_id:
            continue
        for opt in cat["options"]:
            if opt["id"] == choice_id:
                return opt["label"]
    return custom_text.strip() if custom_text else "Not specified"


def _crit(
    low: str, med: str, high: str, life: str, suggested: str = "high"
) -> dict[str, Any]:
    return {
        "label": "How critical is this to the business?",
        "options": [
            ["low", low],
            ["med", med],
            ["high", high],
            ["life", life],
        ],
        "suggested": suggested,
    }


def a2_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A2 portfolio form (labels, placeholders, constraint options)."""
    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Source-code portfolio intake",
            "lede": "Confirm where the legacy sources live and how risky this estate is before ranking it.",
            "form_heading": "Tell us about the source estate",
            "primary": {
                "label": "Where does the old code live?",
                "placeholder": "https://git.example.com/legacy/cobol-core.git",
                "hint": "Git URL, mainframe PDS path, or monorepo location",
                "suggested": "https://git.example.com/legacy/cobol-core.git",
            },
            "criticality": _crit(
                "Low (nice to have)",
                "Medium (important)",
                "High (business runs on it)",
                "Life-safety critical",
            ),
            "constraints": {
                "label": "Any regulatory obligations on this code?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / financial controls"],
                    ["pci", "PCI-DSS (payments)"],
                    ["gdpr", "GDPR / privacy"],
                    ["hipaa", "HIPAA / health"],
                    ["other", "Other regulated industry"],
                ],
                "suggested": ["none"],
            },
        },
        "database": {
            "title": "Data-store portfolio intake",
            "lede": "Locate the schemas and stores that must move safely, then score business impact.",
            "form_heading": "Tell us about the data estate",
            "primary": {
                "label": "Where do the schemas and stores live?",
                "placeholder": "db2://prod/claims  ·  oracle://core/ledger",
                "hint": "DB2/Oracle connection refs, schema catalogs, or data dictionary path",
                "suggested": "db2://prod/CLAIMS · oracle://core/LEDGER",
            },
            "criticality": _crit(
                "Low (reporting only)",
                "Medium (supports operations)",
                "High (system of record)",
                "Life-safety / mandatory ledger",
            ),
            "constraints": {
                "label": "Which data controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / financial controls"],
                    ["pci", "PCI-DSS cardholder data"],
                    ["gdpr", "GDPR / privacy / PII"],
                    ["hipaa", "HIPAA / health data"],
                    ["other", "Other regulated data"],
                ],
                "suggested": ["gdpr"],
            },
        },
        "configuration": {
            "title": "Configuration portfolio intake",
            "lede": "Pin down where runtime knobs and environment overlays live before we change them.",
            "form_heading": "Tell us about the configuration estate",
            "primary": {
                "label": "Where do configs and PARMLIB / property files live?",
                "placeholder": "https://git.example.com/ops/config-overlays.git",
                "hint": "Git overlays, PARMLIB, WebSphere/WebLogic config vault",
                "suggested": "https://git.example.com/ops/config-overlays.git",
            },
            "criticality": _crit(
                "Low (non-prod only)",
                "Medium (affects some channels)",
                "High (controls production behavior)",
                "Life-safety / fail-closed configs",
            ),
            "constraints": {
                "label": "Which config controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / change control"],
                    ["secrets", "Vault / KMS secrets"],
                    ["audit", "Audited config diffs"],
                    ["other", "Other controlled configs"],
                ],
                "suggested": ["secrets"],
            },
        },
        "interfaces": {
            "title": "Integration portfolio intake",
            "lede": "Map partner and internal channels so we know what breaks if this slice moves.",
            "form_heading": "Tell us about the interface estate",
            "primary": {
                "label": "Where are interface contracts and channel configs?",
                "placeholder": "https://git.example.com/integration/mq-soap-contracts.git",
                "hint": "OpenAPI/AsyncAPI repos, MQ definitions, EDI partner packs",
                "suggested": "https://git.example.com/integration/mq-soap-contracts.git",
            },
            "criticality": _crit(
                "Low (batch only)",
                "Medium (internal services)",
                "High (customer / partner channels)",
                "Life-safety / real-time payments",
            ),
            "constraints": {
                "label": "Which channel obligations apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["pci", "PCI-DSS (payments)"],
                    ["sox", "SOX / financial messaging"],
                    ["partner_sla", "Partner SLA / versioning"],
                    ["gdpr", "GDPR / privacy in payloads"],
                    ["other", "Other regulated channels"],
                ],
                "suggested": ["partner_sla"],
            },
        },
        "business_docs": {
            "title": "Documentation portfolio intake",
            "lede": "Locate the BRDs, SOPs, and policy manuals this modernization must respect.",
            "form_heading": "Tell us about the documentation estate",
            "primary": {
                "label": "Where do the policy manuals, BRDs, and SOPs live?",
                "placeholder": "https://sharepoint.example.com/sites/ClaimsPolicy",
                "hint": "SharePoint, Confluence, file share, or document vault URL",
                "suggested": "https://sharepoint.example.com/sites/ClaimsPolicy",
            },
            "criticality": _crit(
                "Low (reference only)",
                "Medium (guides day-to-day work)",
                "High (controls claims / pricing decisions)",
                "Life-safety / mandatory compliance docs",
            ),
            "constraints": {
                "label": "Which document controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["traceability", "Traceability IDs required"],
                    ["audit", "Audit / SOX evidence packs"],
                    ["privacy", "PII / privacy redaction"],
                    ["retention", "Retention / records management"],
                    ["other", "Other controlled documents"],
                ],
                "suggested": ["traceability"],
            },
        },
        "transactions": {
            "title": "Workload portfolio intake",
            "lede": "Point to the production journeys we will replay for equivalence and rehearsal.",
            "form_heading": "Tell us about the transaction estate",
            "primary": {
                "label": "Where do production transaction samples / journey packs live?",
                "placeholder": "s3://legacy-workloads/payments/golden-journeys/",
                "hint": "Object store, MQ capture archive, or anonymized replay pack",
                "suggested": "s3://legacy-workloads/payments/golden-journeys/",
            },
            "criticality": _crit(
                "Low (batch reports)",
                "Medium (online inquiry)",
                "High (payments / posting)",
                "Life-safety / authorization path",
            ),
            "constraints": {
                "label": "Which workload controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["pci", "PCI-DSS (card / payments)"],
                    ["sox", "SOX / ledger balancing"],
                    ["gdpr", "GDPR / anonymization required"],
                    ["other", "Other regulated workloads"],
                ],
                "suggested": ["sox"],
            },
        },
        "observability": {
            "title": "Observability portfolio intake",
            "lede": "Find the logs and traces we need to compare old vs new safely.",
            "form_heading": "Tell us about the observability estate",
            "primary": {
                "label": "Where do SMF / APM / log archives live?",
                "placeholder": "https://splunk.example.com · otel-collector://prod",
                "hint": "Splunk/ELK indexes, SMF dumps, OpenTelemetry collectors",
                "suggested": "https://splunk.example.com/en-US/app/legacy-sli",
            },
            "criticality": _crit(
                "Low (nice-to-have dashboards)",
                "Medium (ops monitoring)",
                "High (cutover gate telemetry)",
                "Life-safety / incident bridge signals",
            ),
            "constraints": {
                "label": "Which observability controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["retention", "Log retention / legal hold"],
                    ["privacy", "PII scrubbing in logs"],
                    ["sox", "SOX evidence from audit logs"],
                    ["other", "Other controlled signals"],
                ],
                "suggested": ["privacy"],
            },
        },
        "tests": {
            "title": "Test-asset portfolio intake",
            "lede": "Inventory the suites that already prove correctness — and what must be rebuilt.",
            "form_heading": "Tell us about the test estate",
            "primary": {
                "label": "Where do existing test suites and golden masters live?",
                "placeholder": "https://git.example.com/qa/legacy-characterization.git",
                "hint": "Git test repos, Selenium packs, mainframe compare utilities",
                "suggested": "https://git.example.com/qa/legacy-characterization.git",
            },
            "criticality": _crit(
                "Low (smoke only)",
                "Medium (regression suite)",
                "High (parity gate for cutover)",
                "Life-safety / money-path mutation tests",
            ),
            "constraints": {
                "label": "Which test controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["parity", "Old-vs-new parity required"],
                    ["sox", "SOX / control evidence in tests"],
                    ["pci", "PCI scope test data"],
                    ["other", "Other controlled test assets"],
                ],
                "suggested": ["parity"],
            },
        },
        "defects": {
            "title": "Defect-history portfolio intake",
            "lede": "Point to the incident and change history that reveals modernization hotspots.",
            "form_heading": "Tell us about the defect / change estate",
            "primary": {
                "label": "Where do ServiceNow / Jira / change tickets live?",
                "placeholder": "https://company.service-now.com · https://jira.example.com/LEGACY",
                "hint": "ITSM URL, defect project key, or change-history export path",
                "suggested": "https://company.service-now.com/nav_to.do?uri=incident.do",
            },
            "criticality": _crit(
                "Low (cosmetic defects)",
                "Medium (ops friction)",
                "High (P1 / revenue impact)",
                "Life-safety / regulatory findings",
            ),
            "constraints": {
                "label": "Which history controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / audit findings"],
                    ["p1", "P1 outage bridges"],
                    ["privacy", "Privacy incident logs"],
                    ["other", "Other controlled history"],
                ],
                "suggested": ["p1"],
            },
        },
        "build_deploy": {
            "title": "Build & deploy portfolio intake",
            "lede": "Locate CI/CD and batch schedulers that will carry the modernized slices.",
            "form_heading": "Tell us about the delivery estate",
            "primary": {
                "label": "Where do pipelines and schedulers live?",
                "placeholder": "https://dev.azure.com/org/legacy · Control-M prod",
                "hint": "Jenkins/ADO/GitHub Actions, Control-M/CA-7, Endevor/Changeman",
                "suggested": "https://dev.azure.com/org/legacy-pipelines",
            },
            "criticality": _crit(
                "Low (manual deploys ok)",
                "Medium (shared CI)",
                "High (production release path)",
                "Life-safety / regulated release gates",
            ),
            "constraints": {
                "label": "Which delivery controls apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / segregation of duties"],
                    ["iac", "IaC / environment parity"],
                    ["change", "Change-advisory board"],
                    ["other", "Other controlled delivery"],
                ],
                "suggested": ["sox"],
            },
        },
        "security": {
            "title": "Security & compliance portfolio intake",
            "lede": "Identify identity, access, and compliance packs that constrain the rebuild.",
            "form_heading": "Tell us about the security estate",
            "primary": {
                "label": "Where do RACF / AD / compliance packs live?",
                "placeholder": "racf://prod · https://vault.example.com · sox-evidence/",
                "hint": "RACF/ACF2 exports, AD groups, vault paths, SBOM feeds",
                "suggested": "https://vault.example.com/ui/vault/secrets/legacy",
            },
            "criticality": _crit(
                "Low (non-sensitive)",
                "Medium (internal auth)",
                "High (customer / payment identity)",
                "Life-safety / privileged access",
            ),
            "constraints": {
                "label": "Which security obligations apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / financial controls"],
                    ["pci", "PCI-DSS"],
                    ["gdpr", "GDPR / privacy"],
                    ["hipaa", "HIPAA / health"],
                    ["other", "Other regulated controls"],
                ],
                "suggested": ["sox"],
            },
        },
        "target_state": {
            "title": "Target-state portfolio intake",
            "lede": "Confirm the target architecture ambition and constraints before ranking this initiative.",
            "form_heading": "Tell us about the target-state ambition",
            "primary": {
                "label": "Where is the target-state architecture documented?",
                "placeholder": "https://confluence.example.com/display/ARCH/Target+State",
                "hint": "Architecture wiki, ADR repo, or cloud landing-zone design",
                "suggested": "https://confluence.example.com/display/ARCH/Target+State",
            },
            "criticality": _crit(
                "Low (exploratory)",
                "Medium (preferred pattern)",
                "High (mandated platform)",
                "Life-safety / regulated target controls",
            ),
            "constraints": {
                "label": "Which target-state constraints apply?",
                "options": [
                    ["none", "None / not sure"],
                    ["cloud", "Approved cloud landing zone"],
                    ["sox", "SOX / control-preserving design"],
                    ["data_residency", "Data residency"],
                    ["other", "Other architecture constraints"],
                ],
                "suggested": ["cloud"],
            },
        },
    }
    return profiles.get(category_id) or profiles["legacy_source"]


def a3_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A3 governance & risk form (sensitive fields + policy options)."""
    shared_models = {
        "label": "Which AI models are allowed?",
        "options": [
            ["public", "Public models only (cheap)"],
            ["balanced", "Private + public (balanced)"],
            ["private", "Private/on-premises only (strict)"],
        ],
        "suggested": "balanced",
    }
    shared_gates = {
        "label": "Require manual approval at every gate?",
        "options": [
            ["full", "Yes — full 9 gates"],
            ["auto_low", "Auto-approve low-risk gates"],
        ],
        "suggested": "full",
    }
    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Governance & Risk",
            "lede": "Enforces the rules — what data is sensitive, which AI models are allowed, what regulations apply.",
            "form_heading": "Set the rules",
            "sensitive": {
                "label": "What data is sensitive?",
                "hint": "Tick everything that applies for THIS modernization. Options are shaped by A1 intake and A2 ranking.",
                "options": [
                    ["src_ip", "Proprietary source / algorithms"],
                    ["secrets", "Embedded secrets / credentials in code"],
                    ["comments_pii", "PII or customer data in comments"],
                    ["conn", "Connection strings / endpoints"],
                    ["licenses", "License / IP-restricted modules"],
                ],
            },
        },
        "database": {
            "title": "Governance & Risk · data stores",
            "lede": "Lock down which store fields may leave the perimeter and which models may see them.",
            "form_heading": "Set the data rules",
            "sensitive": {
                "label": "What store fields are sensitive?",
                "hint": "Tick everything that applies. Schema samples with these fields stay off public models.",
                "options": [
                    ["pii", "PII columns"],
                    ["pan", "PAN / cardholder data"],
                    ["acct", "Account identifiers"],
                    ["balances", "Balances / ledgers"],
                    ["addresses", "Addresses / contact"],
                ],
            },
        },
        "configuration": {
            "title": "Governance & Risk · configuration",
            "lede": "Decide which config secrets and overlays stay private before agents rewrite them.",
            "form_heading": "Set the config rules",
            "sensitive": {
                "label": "What configuration is sensitive?",
                "hint": "Tick everything that applies. Secrets never go to public models.",
                "options": [
                    ["secrets", "Secrets / API keys"],
                    ["certs", "Certificates"],
                    ["conn", "Connection strings"],
                    ["rbac", "RBAC / entitlements"],
                    ["env", "Prod environment overlays"],
                ],
            },
        },
        "interfaces": {
            "title": "Governance & Risk · interfaces",
            "lede": "Control which payload fields and partner channels agents may expose to models.",
            "form_heading": "Set the channel rules",
            "sensitive": {
                "label": "What channel data is sensitive?",
                "hint": "Tick everything that applies. Payload samples with these fields stay private.",
                "options": [
                    ["payload_pii", "Payload PII"],
                    ["pan", "Cardholder data"],
                    ["partner_keys", "Partner credentials"],
                    ["routing", "Routing / account numbers"],
                    ["messages", "Message bodies"],
                ],
            },
        },
        "business_docs": {
            "title": "Governance & Risk · documents",
            "lede": "Keep regulated document content off public models while agents extract rules.",
            "form_heading": "Set the document rules",
            "sensitive": {
                "label": "What document content is sensitive?",
                "hint": "Tick everything that applies. Marked content will not be sent to public AI.",
                "options": [
                    ["customer_cases", "Customer case details"],
                    ["ssn", "National IDs"],
                    ["financials", "Financial figures"],
                    ["medical", "Health details"],
                    ["contracts", "Contract clauses"],
                ],
            },
        },
        "security": {
            "title": "Governance & Risk · security",
            "lede": "Tighten model and gate policy for security-sensitive modernization work.",
            "form_heading": "Set the security rules",
            "sensitive": {
                "label": "What security material is sensitive?",
                "hint": "Tick everything that applies. Agents keep these off public models.",
                "options": [
                    ["creds", "Credentials / vault paths"],
                    ["keys", "Encryption keys"],
                    ["findings", "Vulnerability findings"],
                    ["entitlements", "Entitlement maps"],
                    ["audit", "Audit trails"],
                ],
            },
        },
    }
    base = profiles.get(category_id) or profiles["legacy_source"]
    return {
        **base,
        "models": shared_models,
        "gates": shared_gates,
        "sensitivity_map": {"public": "low", "balanced": "med", "private": "high"},
    }


def g0_form_profile(category_id: str) -> dict[str, Any]:
    """Plain-English G0 Intake Approval copy shaped by the A1 category."""
    shared = {
        "title": "Gate 0 · Intake Approval",
        "lede": (
            "A human approves the scope, data classification, and access policy "
            "before anything else runs."
        ),
        "approver_heading": "You are the approver",
        "reject_consequence": (
            "What happens if you reject? The pipeline routes back to the earlier step "
            "and asks the agent to try again with your feedback."
        ),
        "checklist_note": "Click each item to confirm — nothing is ticked for you.",
    }
    by_cat: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "policy_labels": [
                "What we may read",
                "How carefully we treat data",
                "Which AI models may help",
                "Spend ceiling",
            ],
            "checklist": [
                ["business_case", "The business case for modernising this estate is clear"],
                ["data_class", "Sensitive data classes from Governance & Risk look right"],
                ["access_policy", "The AI access policy matches how careful we must be"],
                ["scope_ok", "I approve reading this system's code under these rules"],
            ],
        },
        "database": {
            "policy_labels": [
                "Which stores we may inspect",
                "How carefully we treat data",
                "Which AI models may help",
                "Spend ceiling",
            ],
            "checklist": [
                ["business_case", "The reason to modernise these data stores is clear"],
                ["data_class", "Sensitive columns / fields are correctly classified"],
                ["access_policy", "Model access rules protect store contents"],
                ["scope_ok", "I approve inspecting these stores under these rules"],
            ],
        },
        "configuration": {
            "policy_labels": [
                "Which config we may read",
                "How carefully we treat secrets",
                "Which AI models may help",
                "Spend ceiling",
            ],
            "checklist": [
                ["business_case", "The reason to modernise this configuration is clear"],
                ["data_class", "Secrets and overlays are correctly marked sensitive"],
                ["access_policy", "Model access rules keep secrets off public AI"],
                ["scope_ok", "I approve reading configuration under these rules"],
            ],
        },
        "interfaces": {
            "policy_labels": [
                "Which channels we may read",
                "How carefully we treat payloads",
                "Which AI models may help",
                "Spend ceiling",
            ],
            "checklist": [
                ["business_case", "The reason to modernise these interfaces is clear"],
                ["data_class", "Sensitive payload fields are correctly classified"],
                ["access_policy", "Model access rules protect partner channels"],
                ["scope_ok", "I approve reading interface traffic under these rules"],
            ],
        },
        "business_docs": {
            "policy_labels": [
                "Which documents we may read",
                "How carefully we treat content",
                "Which AI models may help",
                "Spend ceiling",
            ],
            "checklist": [
                ["business_case", "The business documentation case is clear"],
                ["data_class", "Sensitive document content is correctly classified"],
                ["access_policy", "Model access rules keep regulated text private"],
                ["scope_ok", "I approve reading these documents under these rules"],
            ],
        },
        "security": {
            "policy_labels": [
                "What security material we may touch",
                "How carefully we treat findings",
                "Which AI models may help",
                "Spend ceiling",
            ],
            "checklist": [
                ["business_case", "The security modernisation case is clear"],
                ["data_class", "Credentials and findings are correctly classified"],
                ["access_policy", "Model access rules are strict enough for security work"],
                ["scope_ok", "I approve this security scope under these rules"],
            ],
        },
    }
    cat = by_cat.get(category_id) or by_cat["legacy_source"]
    return {**shared, **cat}


def g1_form_profile(category_id: str) -> dict[str, Any]:
    """Plain-English G1 Discovery Approval copy shaped by the A1 category."""
    shared = {
        "title": "Gate 1 · Discovery Approval",
        "lede": (
            "The most critical gate. Humans confirm we understood the old system "
            "correctly before we start rebuilding."
        ),
        "approver_heading": "You are the approver",
        "expected_approvers": "Subject matter expert + architect",
        "reject_consequence": (
            "What happens if you reject? The pipeline routes back to Runtime Behaviour Mining "
            "and asks discovery agents to try again with your feedback."
        ),
        "checklist_note": "Click each item to confirm — nothing is ticked for you.",
        "evidence_heading": "Discovery evidence · from prior agents",
        "evidence_intro": (
            "These facts were produced by Agents A5–A8. Approve only if they match how "
            "the estate works today."
        ),
    }
    by_cat: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "checklist_templates": [
                ["rules_ok", "All {rules} business rules make sense for this estate"],
                ["deps_ok", "The dependency / structure map from code analysis looks complete"],
                ["tx_ok", "Critical transactions from runtime mining are identified"],
                ["gaps_ok", "No obvious gaps remain before we redesign"],
            ],
        },
        "database": {
            "checklist_templates": [
                ["rules_ok", "All {rules} data rules / constraints make sense"],
                ["deps_ok", "Store relationships and dependencies look complete"],
                ["tx_ok", "Critical data journeys from runtime mining are identified"],
                ["gaps_ok", "No obvious schema or access gaps remain"],
            ],
        },
        "interfaces": {
            "checklist_templates": [
                ["rules_ok", "All {rules} interface rules make sense"],
                ["deps_ok", "Channel / partner dependency map looks complete"],
                ["tx_ok", "Critical interface transactions are identified"],
                ["gaps_ok", "No obvious contract gaps remain"],
            ],
        },
        "business_docs": {
            "checklist_templates": [
                ["rules_ok", "All {rules} documented rules match how the business works"],
                ["deps_ok", "Documented process dependencies look complete"],
                ["tx_ok", "Critical process journeys are identified"],
                ["gaps_ok", "No obvious documentation gaps remain"],
            ],
        },
    }
    cat = by_cat.get(category_id) or by_cat["legacy_source"]
    return {**shared, **cat}


def g2_form_profile(category_id: str) -> dict[str, Any]:
    """Plain-English G2 Architecture Approval copy shaped by the A1 category.

    Checklist templates mirror the Human Gate pattern used at G3 (~8 mandatory
    items) and are refined by the LLM using A9–A11 execution facts + path map.
    """
    shared = {
        "title": "Approve the design",
        "lede": "Do you approve this shape and this build order?",
        "approver_heading": "You are the approver",
        "expected_approvers": "Architecture board",
        "reject_consequence": (
            "What happens if you reject? The pipeline routes back to Data Modernization "
            "and asks design agents to try again with your feedback."
        ),
        "checklist_heading": "Human gate checklist",
        "checklist_note": (
            "Checklist items combine the step's standard controls with your A1 category, "
            "requirement, strategy, and the agent & gate map combination."
        ),
        "evidence_heading": "Design evidence · from prior agents",
        "evidence_intro": (
            "These facts were produced by Agents A9–A11 on the active path. "
            "Approve only if shape, contracts, and data strategy match intake."
        ),
        "comparison_heading": "Previous → target architecture",
        "comparison_intro": (
            "Compare the as-is estate with the target design before you approve construction."
        ),
    }
    # Shared 8-item skeleton; category packs refine wording only.
    base_eight = [
        ["shape_ok", "I approve the {services} proposed service / domain boundaries"],
        ["build_ok", "I approve the build order ({build_first}) for this modernization strategy"],
        ["contracts_ok", "Interface contracts ({rest} REST · {events} events) cover partners and piece boundaries"],
        ["path_ok", "I confirm Agents A9–A11 on the movement path produced the design I am approving"],
        ["data_ok", "Data ownership and cutover strategy ({data_strategy}) are clear and acceptable"],
        ["strategy_ok", "I confirm the target architecture matches A1 strategy «{strategy}» and the requirement"],
        ["compare_ok", "I confirm previous → target deltas are understood and acceptable"],
        ["security_ok", "Security / auth design for the target architecture has been reviewed"],
    ]
    by_cat: dict[str, dict[str, Any]] = {
        "legacy_source": {"checklist_templates": base_eight},
        "database": {
            "checklist_templates": [
                ["shape_ok", "I approve the {services} data-owning service boundaries"],
                ["build_ok", "I approve the build order ({build_first}) for data-first modernization"],
                ["contracts_ok", "API and event contracts ({rest}/{events}) protect table ownership"],
                ["path_ok", "I confirm A9–A11 on the path produced the data service design I am approving"],
                ["data_ok", "Data ownership and cutover strategy ({data_strategy}) are clear"],
                ["strategy_ok", "I confirm the design matches A1 strategy «{strategy}» and the data requirement"],
                ["compare_ok", "I confirm previous → target data-architecture deltas are acceptable"],
                ["security_ok", "Security design for data services has been reviewed"],
            ],
        },
        "interfaces": {
            "checklist_templates": [
                ["shape_ok", "I approve the {services} interface / channel service boundaries"],
                ["build_ok", "I approve the build order ({build_first}) for interface modernization"],
                ["contracts_ok", "Partner contracts ({rest} REST · {events} events) match intake interfaces"],
                ["path_ok", "I confirm A9–A11 on the path produced the interface design I am approving"],
                ["data_ok", "Ownership of interchange data ({data_strategy}) is clear"],
                ["strategy_ok", "I confirm the design matches A1 strategy «{strategy}» and the interface requirement"],
                ["compare_ok", "I confirm previous → target interface deltas are acceptable"],
                ["security_ok", "Partner auth / security design has been reviewed"],
            ],
        },
        "business_docs": {
            "checklist_templates": [
                ["shape_ok", "I approve the {services} process-aligned service boundaries"],
                ["build_ok", "I approve the build order ({build_first}) for process modernization"],
                ["contracts_ok", "Service contracts ({rest}/{events}) match documented process hand-offs"],
                ["path_ok", "I confirm A9–A11 on the path produced the process design I am approving"],
                ["data_ok", "Data ownership for process systems ({data_strategy}) is clear"],
                ["strategy_ok", "I confirm the design matches A1 strategy «{strategy}» and the process requirement"],
                ["compare_ok", "I confirm previous → target process-architecture deltas are acceptable"],
                ["security_ok", "Security design for the new process architecture has been reviewed"],
            ],
        },
    }
    cat = by_cat.get(category_id) or by_cat["legacy_source"]
    return {**shared, **cat}


def g3_form_profile(category_id: str) -> dict[str, Any]:
    """Plain-English G3 Code Approval copy shaped by the A1 category.

    Checklist templates (~8–9 mandatory items) are refined by the LLM using
    A12 code-generation + A13 integration-bridge facts and the path map.
    """
    shared = {
        "title": "Approve the new code",
        "lede": "Does this code look right to merge?",
        "approver_heading": "You are the approver",
        "expected_approvers": "Engineering lead",
        "reject_consequence": (
            "What happens if you reject? The pipeline routes back to Code generation "
            "so A12/A13 can fix gaps with your feedback."
        ),
        "checklist_heading": "Human gate checklist",
        "checklist_note": (
            "Checklist items combine the step's standard controls with your A1 category, "
            "requirement, strategy, and the agent & gate map combination."
        ),
        "evidence_heading": "Code evidence · from prior agents",
        "evidence_intro": (
            "These facts were produced by Agents A12–A13 on the active path. "
            "Approve only if generated code, provenance, and bridges are safe to merge."
        ),
    }
    base_nine = [
        ["merge_ok", "I approve merging the generated code for this slice ({services} services · {methods} rule methods)"],
        ["stack_ok", "I confirm the generated stack ({stack}) matches the approved target architecture"],
        ["prov_ok", "I confirm provenance links every method to an approved business rule"],
        ["path_ok", "I confirm Agents A12–A13 on the movement path produced the code I am approving"],
        ["bridge_ok", "I confirm bridges / facades ({bridges}) are safe for dual-run"],
        ["strategy_ok", "I confirm the generated code matches A1 strategy «{strategy}» and the requirement"],
        ["sec_ok", "I confirm no high-severity security findings remain open"],
        ["trace_ok", "I confirm traceability is on so the merge can be audited"],
        ["slice_ok", "I confirm this slice is complete enough to hand off to test generation"],
    ]
    by_cat: dict[str, dict[str, Any]] = {
        "legacy_source": {"checklist_templates": base_nine},
        "database": {
            "checklist_templates": [
                ["merge_ok", "I approve merging the generated data-service code ({services} services · {methods} methods)"],
                ["stack_ok", "I confirm the stack ({stack}) matches the approved data architecture"],
                ["prov_ok", "I confirm provenance links code to approved data rules"],
                ["path_ok", "I confirm A12–A13 on the path produced the data-service code I am approving"],
                ["bridge_ok", "I confirm data bridges / facades ({bridges}) are safe for dual-run"],
                ["strategy_ok", "I confirm the code matches A1 strategy «{strategy}»"],
                ["sec_ok", "I confirm no high-severity data-security findings remain open"],
                ["trace_ok", "I confirm provenance/traceability is on for audit"],
                ["slice_ok", "I confirm this data slice is ready for test generation"],
            ],
        },
        "interfaces": {
            "checklist_templates": [
                ["merge_ok", "I approve merging the generated interface code ({services} services · {methods} methods)"],
                ["stack_ok", "I confirm the stack ({stack}) matches partner interface design"],
                ["prov_ok", "I confirm provenance links code to approved interface rules"],
                ["path_ok", "I confirm A12–A13 on the path produced the interface code I am approving"],
                ["bridge_ok", "I confirm partner bridges / facades ({bridges}) are safe for dual-run"],
                ["strategy_ok", "I confirm the code matches A1 strategy «{strategy}»"],
                ["sec_ok", "I confirm no high-severity partner-security findings remain open"],
                ["trace_ok", "I confirm provenance/traceability is on for audit"],
                ["slice_ok", "I confirm this interface slice is ready for test generation"],
            ],
        },
        "business_docs": {
            "checklist_templates": [
                ["merge_ok", "I approve merging the process-aligned code ({services} services · {methods} methods)"],
                ["stack_ok", "I confirm the stack ({stack}) matches the approved process architecture"],
                ["prov_ok", "I confirm provenance links code to approved process rules"],
                ["path_ok", "I confirm A12–A13 on the path produced the process code I am approving"],
                ["bridge_ok", "I confirm process bridges / facades ({bridges}) are safe for dual-run"],
                ["strategy_ok", "I confirm the code matches A1 strategy «{strategy}»"],
                ["sec_ok", "I confirm no high-severity security findings remain open"],
                ["trace_ok", "I confirm provenance/traceability is on for audit"],
                ["slice_ok", "I confirm this process slice is ready for test generation"],
            ],
        },
    }
    cat = by_cat.get(category_id) or by_cat["legacy_source"]
    return {**shared, **cat}


def a14_form_profile(category_id: str) -> dict[str, Any]:
    """Plain-English A14 Test generation copy shaped by the A1 category.

    Checklist / what-to-test templates (~7–9 items) are refined by the LLM using
    A12 code-generation + A13 bridges + G3 approval facts and the path map.
    """
    shared = {
        "title": "Test generation",
        "lede": (
            "Writes test suites from approved rules and journeys so equivalence "
            "is proven against intent, not against generated code."
        ),
        "form_heading": "SET UP THIS STEP — YOU DECIDE",
        "kinds_label": "WHAT KINDS OF TESTS?",
        "checklist_heading": "OPERATOR CHECKLIST (OPTIONAL)",
        "checklist_note": (
            "Checklist items combine the step's standard controls with your A1 category, "
            "requirement, strategy, and the agent & gate map combination. These do not "
            "block Run — confirm them when useful, or use Confirm all."
        ),
        "what_to_test_heading": "WHAT NEEDS TO BE TESTED",
        "what_to_test_intro": (
            "Derived from approved rules, customer journeys, generated services, and "
            "bridges on the active path — not from the generated code itself."
        ),
        "kinds_options": [
            ["unit", "One test per business rule", "The main safety net"],
            ["integration", "Tests against a real database", ""],
            ["edge", "Awkward edge cases", "Boundaries, zeros, negatives"],
            ["parity", "Characterization / parity vs legacy", "Prove equivalence"],
        ],
        "kinds_suggested": ["unit", "integration", "edge"],
    }
    base_seven = [
        ["rules_ok", "Confirm tests are derived from {rules} approved rules, not new code alone"],
        ["coverage_ok", "Confirm coverage targets match gate G4 expectations for «{strategy}»"],
        ["journeys_ok", "Confirm characterization / parity tests cover {journeys} critical journeys"],
        ["path_ok", "Confirm this step still belongs on the path for «{category}»"],
        ["req_ok", "Confirm scope still matches the A1 requirement: «{requirement}»"],
        ["strategy_ok", "Confirm the modernization strategy still applies: «{strategy}»"],
        ["project_ok", "Confirm work remains under project «{project}»"],
    ]
    by_cat: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "checklist_templates": base_seven
            + [
                ["stack_ok", "Confirm tests exercise the approved {stack} services ({services})"],
                ["bridge_ok", "Confirm dual-run bridges ({bridges}) have parity coverage"],
            ],
        },
        "database": {
            "checklist_templates": [
                ["rules_ok", "Confirm data tests come from {rules} approved data rules, not schema dump alone"],
                ["coverage_ok", "Confirm G4 coverage for data equivalence under «{strategy}»"],
                ["journeys_ok", "Confirm {journeys} critical data journeys have parity checks"],
                ["path_ok", "Confirm A14 belongs on the path for «{category}»"],
                ["req_ok", "Confirm scope still matches: «{requirement}»"],
                ["strategy_ok", "Confirm strategy «{strategy}» still drives test kinds"],
                ["project_ok", "Confirm project «{project}»"],
                ["stack_ok", "Confirm {stack} data services ({services}) are under test"],
                ["bridge_ok", "Confirm data bridges ({bridges}) have dual-write parity tests"],
            ],
        },
        "interfaces": {
            "checklist_templates": [
                ["rules_ok", "Confirm interface tests come from {rules} approved partner rules"],
                ["coverage_ok", "Confirm G4 coverage for contract equivalence under «{strategy}»"],
                ["journeys_ok", "Confirm {journeys} partner journeys have characterization tests"],
                ["path_ok", "Confirm A14 belongs on the path for «{category}»"],
                ["req_ok", "Confirm scope still matches: «{requirement}»"],
                ["strategy_ok", "Confirm strategy «{strategy}» still drives test kinds"],
                ["project_ok", "Confirm project «{project}»"],
                ["stack_ok", "Confirm {stack} interface services ({services}) are under test"],
                ["bridge_ok", "Confirm partner bridges ({bridges}) have parity coverage"],
            ],
        },
        "business_docs": {
            "checklist_templates": [
                ["rules_ok", "Confirm process tests come from {rules} approved process rules"],
                ["coverage_ok", "Confirm G4 coverage for process equivalence under «{strategy}»"],
                ["journeys_ok", "Confirm {journeys} critical process journeys are covered"],
                ["path_ok", "Confirm A14 belongs on the path for «{category}»"],
                ["req_ok", "Confirm scope still matches: «{requirement}»"],
                ["strategy_ok", "Confirm strategy «{strategy}» still drives test kinds"],
                ["project_ok", "Confirm project «{project}»"],
                ["stack_ok", "Confirm {stack} process services ({services}) are under test"],
                ["bridge_ok", "Confirm process bridges ({bridges}) have parity coverage"],
            ],
        },
    }
    cat = by_cat.get(category_id) or by_cat["legacy_source"]
    return {**shared, **cat}


def a4_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A4 Repository Discovery form (repo URLs + missing deps)."""
    shared_sources = {
        "label": "What should we read?",
        "hint": "Tick every source type the factory should inventory.",
        "options": [
            ["code", "The programs themselves"],
            ["copybooks", "Shared data layouts / copybooks"],
            ["jcl", "Job scripts / batch"],
            ["db", "Database structure"],
            ["docs", "Design / business documents"],
            ["config", "Config / PARMLIB overlays"],
        ],
        "suggested": ["code", "copybooks", "jcl", "db"],
    }
    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Repository discovery",
            "lede": "Reads your old code repository and figures out what is in it — modules, dependencies, dead code.",
            "form_heading": "Where is the old code?",
            "repos_label": "Repository URLs — one per line",
            "repos_hint": "Include mainframe libraries, source repositories, database schemas, batch job schedulers.",
            "repos_placeholder": (
                "git://mainframe-vault/midwestbank/balance-cobol.git\n"
                "mainframe://COBOL.PROD.SOURCE.PDS\n"
                "db2://midwestbank-prod/schemas/BALANCE_SCHEMA\n"
                "tws://batch-scheduler/BALANCE_NIGHTLY"
            ),
            "repos_suggested": (
                "git://mainframe-vault/midwestbank/balance-cobol.git\n"
                "mainframe://COBOL.PROD.SOURCE.PDS\n"
                "db2://midwestbank-prod/schemas/BALANCE_SCHEMA\n"
                "tws://batch-scheduler/BALANCE_NIGHTLY"
            ),
            "missing_label": "Any missing dependencies you know about?",
            "missing_hint": "If a copybook or shared library is missing, tell us here.",
            "missing_placeholder": "The CUSTOMER-INFO copybook is on an old tape backup — we are recovering it.",
            "missing_suggested": "The CUSTOMER-INFO copybook is on an old tape backup — we are recovering it.",
            "sources": {**shared_sources, "suggested": ["code", "copybooks", "jcl", "db"]},
        },
        "database": {
            "title": "Repository discovery · data stores",
            "lede": "Locate schemas and data dictionaries so discovery can map tables, views, and stored procedures.",
            "form_heading": "Where do the stores and schemas live?",
            "repos_label": "Store / schema references — one per line",
            "repos_hint": "DB2, Oracle, SQL Server catalogs, data dictionaries, ETL job libraries.",
            "repos_placeholder": (
                "db2://midwestbank-prod/schemas/BALANCE_SCHEMA\n"
                "oracle://core-ledger/CLAIMS\n"
                "git://data-dict/midwestbank/schema-docs.git"
            ),
            "repos_suggested": (
                "db2://midwestbank-prod/schemas/BALANCE_SCHEMA\n"
                "oracle://core-ledger/CLAIMS\n"
                "git://data-dict/midwestbank/schema-docs.git"
            ),
            "missing_label": "Any missing schemas or dictionaries?",
            "missing_hint": "Offline catalogs, archived DDL, or vendor packages still to recover.",
            "missing_placeholder": "Historical ARCHIVE schema DDL is only on the DBA share — being restored.",
            "missing_suggested": "Historical ARCHIVE schema DDL is only on the DBA share — being restored.",
            "sources": {**shared_sources, "suggested": ["db", "code", "docs"]},
        },
        "configuration": {
            "title": "Repository discovery · configuration",
            "lede": "Find config overlays, PARMLIB members, and property stores before agents rewrite them.",
            "form_heading": "Where do configs and overlays live?",
            "repos_label": "Config locations — one per line",
            "repos_hint": "Git overlays, PARMLIB, WebSphere/WebLogic config vaults, secret stores (paths only).",
            "repos_placeholder": (
                "git://ops/config-overlays.git\n"
                "mainframe://SYS1.PARMLIB\n"
                "vault://prod/app-config"
            ),
            "repos_suggested": (
                "git://ops/config-overlays.git\n"
                "mainframe://SYS1.PARMLIB\n"
                "vault://prod/app-config"
            ),
            "missing_label": "Any missing config packages?",
            "missing_hint": "Environment overlays, certificates, or feature flags still offline.",
            "missing_placeholder": "Prod WebSphere cell export is on a locked USB — security is releasing a copy.",
            "missing_suggested": "Prod WebSphere cell export is on a locked USB — security is releasing a copy.",
            "sources": {**shared_sources, "suggested": ["config", "code", "docs"]},
        },
        "interfaces": {
            "title": "Repository discovery · interfaces",
            "lede": "Map message contracts, partner channels, and adapters that feed the estate.",
            "form_heading": "Where do interfaces and contracts live?",
            "repos_label": "Interface / contract locations — one per line",
            "repos_hint": "MQ queues, API specs, EDI maps, partner adapter repos.",
            "repos_placeholder": (
                "git://integration/mq-adapters.git\n"
                "mq://PROD.BALANCE.IN\n"
                "git://contracts/openapi/balance-api.git"
            ),
            "repos_suggested": (
                "git://integration/mq-adapters.git\n"
                "mq://PROD.BALANCE.IN\n"
                "git://contracts/openapi/balance-api.git"
            ),
            "missing_label": "Any missing partner specs?",
            "missing_hint": "Vendor WSDLs, EDI guides, or channel certificates still outstanding.",
            "missing_placeholder": "Partner X ACH mapping guide is only in email — Ops is retrieving it.",
            "missing_suggested": "Partner X ACH mapping guide is only in email — Ops is retrieving it.",
            "sources": {**shared_sources, "suggested": ["code", "docs", "config"]},
        },
        "business_docs": {
            "title": "Repository discovery · documents",
            "lede": "Point discovery at BRDs, SOPs, and training packs that describe how the estate behaves.",
            "form_heading": "Where do the business documents live?",
            "repos_label": "Document libraries — one per line",
            "repos_hint": "SharePoint, Confluence, file shares, scanned BRD vaults.",
            "repos_placeholder": (
                "sharepoint://midwestbank/BRDs/Balance\n"
                "git://docs/business-rules.git\n"
                "file://G:/LegacySOPs/Balance"
            ),
            "repos_suggested": (
                "sharepoint://midwestbank/BRDs/Balance\n"
                "git://docs/business-rules.git\n"
                "file://G:/LegacySOPs/Balance"
            ),
            "missing_label": "Any missing documents?",
            "missing_hint": "Lost SOPs, offline training decks, or paper BRDs being scanned.",
            "missing_placeholder": "1987 rate-table SOP exists only as a scanned PDF on a shared drive.",
            "missing_suggested": "1987 rate-table SOP exists only as a scanned PDF on a shared drive.",
            "sources": {**shared_sources, "suggested": ["docs", "code"]},
        },
        "security": {
            "title": "Repository discovery · security",
            "lede": "Locate entitlement maps, vault paths, and scan artefacts the security agents will need.",
            "form_heading": "Where does security material live?",
            "repos_label": "Security locations — one per line",
            "repos_hint": "Vault paths, IAM exports, scan reports, cert stores (paths only — no secrets).",
            "repos_placeholder": (
                "vault://prod/apps/balance\n"
                "git://security/entitlement-maps.git\n"
                "file://G:/SecScans/Balance"
            ),
            "repos_suggested": (
                "vault://prod/apps/balance\n"
                "git://security/entitlement-maps.git\n"
                "file://G:/SecScans/Balance"
            ),
            "missing_label": "Any missing security artefacts?",
            "missing_hint": "Offline vault exports, expired scan reports, entitlement spreadsheets.",
            "missing_placeholder": "Last year entitlement spreadsheet is with IAM — requesting a fresh export.",
            "missing_suggested": "Last year entitlement spreadsheet is with IAM — requesting a fresh export.",
            "sources": {**shared_sources, "suggested": ["config", "docs", "code"]},
        },
        "transactions": {
            "title": "Repository discovery · transaction estate",
            "lede": "Locate posting engines, journals, and batch chains that drive money movement.",
            "form_heading": "Where do transaction systems live?",
            "repos_label": "Transaction repositories — one per line",
            "repos_hint": "Core posting COBOL, payment adapters, ledger schemas, overnight batch libraries.",
            "repos_placeholder": (
                "git://core/payment-posting.git\n"
                "mainframe://COBOL.PROD.POSTING.PDS\n"
                "db2://ledger-prod/schemas/POSTING"
            ),
            "repos_suggested": (
                "git://core/payment-posting.git\n"
                "mainframe://COBOL.PROD.POSTING.PDS\n"
                "db2://ledger-prod/schemas/POSTING"
            ),
            "missing_label": "Any missing posting libraries?",
            "missing_hint": "Offline journals, archived rate tables, or partner settlement packs.",
            "missing_placeholder": "Month-end settlement copybooks are on tape — Ops is restoring them.",
            "missing_suggested": "Month-end settlement copybooks are on tape — Ops is restoring them.",
            "sources": {**shared_sources, "suggested": ["code", "jcl", "db", "copybooks"]},
        },
        "observability": {
            "title": "Repository discovery · telemetry sources",
            "lede": "Find log pipelines, SMF extracts, and APM configs discovery will inventory.",
            "form_heading": "Where do observability artefacts live?",
            "repos_label": "Telemetry / ops locations — one per line",
            "repos_hint": "Splunk apps, ELK configs, SMF extract jobs, Control-M definitions.",
            "repos_placeholder": (
                "git://ops/otel-collectors.git\n"
                "splunk://apps/balance-monitoring\n"
                "mainframe://SMF.EXTRACT.JOBS"
            ),
            "repos_suggested": (
                "git://ops/otel-collectors.git\n"
                "splunk://apps/balance-monitoring\n"
                "mainframe://SMF.EXTRACT.JOBS"
            ),
            "missing_label": "Any missing telemetry packs?",
            "missing_hint": "Offline dashboards, retired APM projects, or SMF layouts still recovering.",
            "missing_placeholder": "Legacy CICS monitoring pack is only on the SRE share — requesting access.",
            "missing_suggested": "Legacy CICS monitoring pack is only on the SRE share — requesting access.",
            "sources": {**shared_sources, "suggested": ["config", "jcl", "docs"]},
        },
        "tests": {
            "title": "Repository discovery · test assets",
            "lede": "Point discovery at characterization suites, golden files, and fixture libraries.",
            "form_heading": "Where do test assets live?",
            "repos_label": "Test repository URLs — one per line",
            "repos_hint": "Unit/integration suites, golden output vaults, mainframe regression packs.",
            "repos_placeholder": (
                "git://qa/characterization-tests.git\n"
                "file://G:/GoldenOutputs/Balance\n"
                "mainframe://TEST.REGRESSION.PDS"
            ),
            "repos_suggested": (
                "git://qa/characterization-tests.git\n"
                "file://G:/GoldenOutputs/Balance\n"
                "mainframe://TEST.REGRESSION.PDS"
            ),
            "missing_label": "Any missing fixtures?",
            "missing_hint": "Lost golden files, offline data masks, or SME-owned edge cases.",
            "missing_placeholder": "Q4 golden ledger dump is on a locked NAS — QA is unlocking it.",
            "missing_suggested": "Q4 golden ledger dump is on a locked NAS — QA is unlocking it.",
            "sources": {**shared_sources, "suggested": ["code", "docs", "db"]},
        },
        "defects": {
            "title": "Repository discovery · defect history",
            "lede": "Locate defect trackers and hot-fix libraries that explain recurring failures.",
            "form_heading": "Where do defect and hot-fix artefacts live?",
            "repos_label": "Defect / hot-fix locations — one per line",
            "repos_hint": "Jira exports, ServiceNow, mainframe APAR libraries, patch repos.",
            "repos_placeholder": (
                "jira://midwestbank/BALANCE\n"
                "git://hotfix/balance-patches.git\n"
                "mainframe://SYS1.APAR.LIB"
            ),
            "repos_suggested": (
                "jira://midwestbank/BALANCE\n"
                "git://hotfix/balance-patches.git\n"
                "mainframe://SYS1.APAR.LIB"
            ),
            "missing_label": "Any missing defect packs?",
            "missing_hint": "Offline APAR binders, retired trackers, or SME incident notes.",
            "missing_placeholder": "2019 severity-1 postmortems exist only as email PDFs — collecting them.",
            "missing_suggested": "2019 severity-1 postmortems exist only as email PDFs — collecting them.",
            "sources": {**shared_sources, "suggested": ["docs", "code", "config"]},
        },
        "build_deploy": {
            "title": "Repository discovery · build and deploy",
            "lede": "Find CI definitions, deploy scripts, and release catalogues before cutover planning.",
            "form_heading": "Where do build and deploy assets live?",
            "repos_label": "CI / CD locations — one per line",
            "repos_hint": "Jenkins/GitHub Actions, ChangeMan, Endevor, deploy runbooks.",
            "repos_placeholder": (
                "git://devops/balance-pipelines.git\n"
                "changeman://PROD/BALANCE\n"
                "file://G:/ReleaseCatalogs/Balance"
            ),
            "repos_suggested": (
                "git://devops/balance-pipelines.git\n"
                "changeman://PROD/BALANCE\n"
                "file://G:/ReleaseCatalogs/Balance"
            ),
            "missing_label": "Any missing release packs?",
            "missing_hint": "Offline deploy PROCs, revoked credentials stores (paths only), old catalogs.",
            "missing_placeholder": "Legacy Endevor map is with platform — requesting a read-only export.",
            "missing_suggested": "Legacy Endevor map is with platform — requesting a read-only export.",
            "sources": {**shared_sources, "suggested": ["config", "jcl", "docs"]},
        },
        "target_state": {
            "title": "Repository discovery · target architecture",
            "lede": "Locate target blueprints and reference repos the strangler path will align to.",
            "form_heading": "Where do target-state artefacts live?",
            "repos_label": "Target architecture locations — one per line",
            "repos_hint": "Reference architectures, cloud landing zones, service templates.",
            "repos_placeholder": (
                "git://architecture/target-state.git\n"
                "sharepoint://midwestbank/ReferenceArchitecture\n"
                "git://platform/service-templates.git"
            ),
            "repos_suggested": (
                "git://architecture/target-state.git\n"
                "sharepoint://midwestbank/ReferenceArchitecture\n"
                "git://platform/service-templates.git"
            ),
            "missing_label": "Any missing blueprints?",
            "missing_hint": "Draft ADRs, offline Visio packs, or vendor reference kits.",
            "missing_placeholder": "Cloud landing-zone ADR pack is in review — architecture will share the draft.",
            "missing_suggested": "Cloud landing-zone ADR pack is in review — architecture will share the draft.",
            "sources": {**shared_sources, "suggested": ["docs", "config", "code"]},
        },
    }
    return profiles.get(category_id) or profiles["legacy_source"]



def a5_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A5 Legacy Code Analysis form + result templates."""
    shared_depth = {
        "label": "How deeply should we read the code?",
        "hint": "Full analysis traces every call and data flow. Structure-only is faster.",
        "options": [
            ["full", "Fully — every call and every data flow"],
            ["struct", "Structure only — faster, less detail"],
        ],
        "suggested": "full",
    }
    shared_focus = {
        "label": "What should analysis prioritise?",
        "hint": "Choose work that continues what the prior agent already inventoried.",
        "options": [
            ["calls", "Call graph and entry points"],
            ["dataflow", "Data flow and working storage"],
            ["risky", "Risky constructs (GOTO, dynamic CALL)"],
            ["batch", "Batch chains and job scripts"],
            ["schema", "Schema / file I-O boundaries"],
        ],
        "suggested": ["calls", "dataflow", "risky"],
    }
    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Legacy code analysis",
            "lede": (
                "Digs deep into the old code and builds a map of how everything connects "
                "— every function, every call, every data flow."
            ),
            "form_heading": "Set the analysis lens",
            "depth": {**shared_depth},
            "focus": {
                **shared_focus,
                "suggested": ["calls", "dataflow", "risky", "batch"],
            },
            "result_banner": {
                "headline": "Structural analysis complete.",
                "body": (
                    "We built a map showing exactly how every part of the code connects "
                    "to every other part. Some of it is surprising."
                ),
            },
            "structure": {
                "entry_points": 6,
                "nested_calls_factor": 135,
                "circular_deps": 14,
                "complexity_avg": 18.4,
                "complexity_label": "high",
                "longest_program": "BAL0847.CBL",
                "longest_lines": 9340,
            },
            "risks": [
                ["high", "Dynamic call to program name at runtime", 17],
                ["med", "GOTO into paragraph mid-flow", 88],
                ["med", "Shared working storage across modules", 23],
            ],
        },
        "database": {
            "title": "Legacy code analysis · data access",
            "lede": "Maps how programs touch schemas, cursors, and file I-O so cutover risks are visible early.",
            "form_heading": "Set the data-access analysis lens",
            "depth": {**shared_depth, "suggested": "full"},
            "focus": {
                **shared_focus,
                "options": [
                    ["calls", "Program-to-program calls"],
                    ["dataflow", "Cursor and host-variable flow"],
                    ["risky", "Dynamic SQL and unqualified tables"],
                    ["schema", "Schema / file I-O boundaries"],
                    ["batch", "Batch load and extract jobs"],
                ],
                "suggested": ["schema", "dataflow", "risky"],
            },
            "result_banner": {
                "headline": "Data-access structural map complete.",
                "body": "Every cursor, host variable, and I-O boundary from discovery is wired into the call map.",
            },
            "structure": {
                "entry_points": 9,
                "nested_calls_factor": 98,
                "circular_deps": 7,
                "complexity_avg": 14.2,
                "complexity_label": "elevated",
                "longest_program": "DBLOAD01.CBL",
                "longest_lines": 6120,
            },
            "risks": [
                ["high", "Dynamic SQL built at runtime", 11],
                ["med", "Unqualified table references across schemas", 34],
                ["med", "Cursor left open across paragraph boundaries", 19],
            ],
        },
        "configuration": {
            "title": "Legacy code analysis · config-driven paths",
            "lede": "Traces how PARMLIB and overlay knobs change control flow inside the estate.",
            "form_heading": "Set the configuration analysis lens",
            "depth": {**shared_depth},
            "focus": {
                **shared_focus,
                "suggested": ["calls", "risky", "dataflow"],
            },
            "result_banner": {
                "headline": "Config-aware structural map complete.",
                "body": "Branching driven by overlays and PARMLIB members is now visible on the call graph.",
            },
            "structure": {
                "entry_points": 5,
                "nested_calls_factor": 72,
                "circular_deps": 4,
                "complexity_avg": 12.8,
                "complexity_label": "moderate",
                "longest_program": "CFGINIT.CBL",
                "longest_lines": 2810,
            },
            "risks": [
                ["high", "Hardcoded dataset names beside config lookups", 9],
                ["med", "Feature flag tested mid-paragraph with GOTO", 27],
                ["med", "Shared COMMON area mutated by config loaders", 15],
            ],
        },
        "interfaces": {
            "title": "Legacy code analysis · interface adapters",
            "lede": "Maps adapter entry points, MQ/API bridges, and partner call chains from discovery.",
            "form_heading": "Set the interface analysis lens",
            "depth": {**shared_depth},
            "focus": {
                **shared_focus,
                "suggested": ["calls", "risky", "batch"],
            },
            "result_banner": {
                "headline": "Interface structural map complete.",
                "body": "Partner channels and adapter programs are linked to the programs discovery inventoried.",
            },
            "structure": {
                "entry_points": 11,
                "nested_calls_factor": 110,
                "circular_deps": 6,
                "complexity_avg": 15.6,
                "complexity_label": "elevated",
                "longest_program": "MQADAPT.CBL",
                "longest_lines": 4480,
            },
            "risks": [
                ["high", "Dynamic partner program name from message header", 13],
                ["med", "GOTO retry loops in adapter error paths", 41],
                ["med", "Shared buffer reused across channel handlers", 18],
            ],
        },
        "transactions": {
            "title": "Legacy code analysis · posting engines",
            "lede": "Deep-reads posting and settlement programs to expose call cycles and money-path complexity.",
            "form_heading": "Set the transaction analysis lens",
            "depth": {**shared_depth, "suggested": "full"},
            "focus": {
                **shared_focus,
                "suggested": ["calls", "dataflow", "risky", "batch"],
            },
            "result_banner": {
                "headline": "Posting-path structural map complete.",
                "body": "Ledger and settlement call chains from discovery now show cycles and high-complexity hotspots.",
            },
            "structure": {
                "entry_points": 8,
                "nested_calls_factor": 160,
                "circular_deps": 21,
                "complexity_avg": 22.1,
                "complexity_label": "high",
                "longest_program": "POSTMAIN.CBL",
                "longest_lines": 11240,
            },
            "risks": [
                ["high", "Dynamic CALL to settlement program by code", 22],
                ["med", "GOTO into catch-up paragraph mid-posting", 96],
                ["med", "Shared WORKING-STORAGE across posting modules", 31],
            ],
        },
        "tests": {
            "title": "Legacy code analysis · characterization targets",
            "lede": "Maps programs and flows that characterization suites must cover after discovery.",
            "form_heading": "Set the testability analysis lens",
            "depth": {**shared_depth},
            "focus": {
                **shared_focus,
                "suggested": ["calls", "risky", "dataflow"],
            },
            "result_banner": {
                "headline": "Testability structural map complete.",
                "body": "Entry points and risky constructs are ranked so golden tests can target the hardest seams first.",
            },
            "structure": {
                "entry_points": 7,
                "nested_calls_factor": 88,
                "circular_deps": 5,
                "complexity_avg": 13.9,
                "complexity_label": "elevated",
                "longest_program": "REGTEST.CBL",
                "longest_lines": 3920,
            },
            "risks": [
                ["high", "Untestable dynamic CALL without stub seam", 8],
                ["med", "GOTO skipping assertion paragraphs", 29],
                ["med", "Shared fixture storage across test drivers", 12],
            ],
        },
        "defects": {
            "title": "Legacy code analysis · defect hotspots",
            "lede": "Focuses structural reading on hot-fix and high-defect programs surfaced by discovery.",
            "form_heading": "Set the defect-hotspot analysis lens",
            "depth": {**shared_depth},
            "focus": {
                **shared_focus,
                "suggested": ["risky", "calls", "dataflow"],
            },
            "result_banner": {
                "headline": "Hotspot structural map complete.",
                "body": "Programs tied to recurring defects now show the call and storage patterns that keep biting.",
            },
            "structure": {
                "entry_points": 4,
                "nested_calls_factor": 120,
                "circular_deps": 11,
                "complexity_avg": 19.7,
                "complexity_label": "high",
                "longest_program": "HOTFIX3.CBL",
                "longest_lines": 7055,
            },
            "risks": [
                ["high", "Dynamic CALL introduced by emergency patch", 14],
                ["med", "GOTO residual from defect workarounds", 67],
                ["med", "Shared storage race between modules", 20],
            ],
        },
        "security": {
            "title": "Legacy code analysis · sensitive paths",
            "lede": "Traces entitlement and sensitive-data paths through the programs discovery inventoried.",
            "form_heading": "Set the security analysis lens",
            "depth": {**shared_depth, "suggested": "full"},
            "focus": {
                **shared_focus,
                "suggested": ["dataflow", "risky", "calls"],
            },
            "result_banner": {
                "headline": "Sensitive-path structural map complete.",
                "body": "Calls that touch vaulted credentials and PII buffers are highlighted on the structural map.",
            },
            "structure": {
                "entry_points": 5,
                "nested_calls_factor": 95,
                "circular_deps": 3,
                "complexity_avg": 16.0,
                "complexity_label": "elevated",
                "longest_program": "AUTHCHK.CBL",
                "longest_lines": 5210,
            },
            "risks": [
                ["high", "Dynamic CALL into privileged utility", 6],
                ["med", "GOTO bypassing entitlement check", 24],
                ["med", "Shared buffer holding unmasked account data", 17],
            ],
        },
    }
    # Categories that usually skip A5 still get a safe profile if path promotes it.
    profiles["business_docs"] = {
        "title": "Legacy code analysis · documented flows",
        "lede": "Where documents point at code, analysis maps the referenced programs and data flows.",
        "form_heading": "Set the document-linked analysis lens",
        "depth": {**shared_depth, "suggested": "struct"},
        "focus": {**shared_focus, "suggested": ["calls", "dataflow"]},
        "result_banner": {
            "headline": "Document-linked structural map complete.",
            "body": "Programs named in BRDs and SOPs are now connected on the call graph.",
        },
        "structure": {
            "entry_points": 3,
            "nested_calls_factor": 55,
            "circular_deps": 2,
            "complexity_avg": 10.4,
            "complexity_label": "moderate",
            "longest_program": "DOCRULE.CBL",
            "longest_lines": 2100,
        },
        "risks": [
            ["med", "Undocumented dynamic CALL referenced only in SOP", 5],
            ["med", "GOTO in exception playbook path", 18],
            ["low", "Shared glossary storage across modules", 7],
        ],
    }
    profiles["observability"] = dict(profiles["legacy_source"])
    profiles["observability"]["title"] = "Legacy code analysis · telemetry seams"
    profiles["build_deploy"] = dict(profiles["configuration"])
    profiles["build_deploy"]["title"] = "Legacy code analysis · build-tied modules"
    profiles["target_state"] = dict(profiles["legacy_source"])
    profiles["target_state"]["title"] = "Legacy code analysis · strangler boundaries"
    return profiles.get(category_id) or profiles["legacy_source"]



def synthesize_repository_rules(
    project_name: str = "",
    requirement: str = "",
    code_location: str = "",
    category_id: str = "",
    strategies: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Synthesize repository-derived business rules citing real source files and domain requirements."""
    title = (project_name or "").strip()
    req = (requirement or "").strip()
    loc = (code_location or "").strip()
    strat_text = " ".join(strategies or []).lower()
    combined = f"{title} {req} {loc} {category_id} {strat_text}".lower()

    if any(k in combined for k in ("sas", "data step", "sas7bdat", "proc sql")):
        ext = ".sas"
        prefix = "src"
        f1, f2, f3, f4, f5 = (
            f"{prefix}/fraud_detection{ext}",
            f"{prefix}/policy_premium_calc{ext}",
            f"{prefix}/claims_audit{ext}",
            f"{prefix}/compliance_checks{ext}",
            f"{prefix}/daily_reconciliation{ext}",
        )
        rules = [
            ("BR-001", "Validate Eligibility & Risk Scores in SAS Data Step", "Filter incoming claims where RiskScore > Threshold and FlagSuspicious = 1 before running linear regression.", 0.96, f1, 14, 38),
            ("BR-002", "Calculate Policy Premium Variance via PROC SQL", "Compute premium adjustment = BasePremium * (1 + RiskFactor) and join policyholder master table.", 0.94, f2, 45, 82),
            ("BR-003", "Audit Exception and Variance Records", "Output transaction variance anomalies exceeding $10,000 to error dataset for operator review.", 0.91, f3, 102, 145),
            ("BR-004", "Enforce Compliance with Regulatory Guidelines", "Check customer identity and SSN against compliance blacklist tables before policy issuance.", 0.93, f4, 8, 42),
            ("BR-005", "Reconcile Daily Transaction Workloads", "Aggregate total transaction amounts by region and verify zero ledger discrepancy.", 0.89, f5, 50, 95),
            ("BR-006", "High-Value Transaction Velocity Limit", "Daily cumulative transaction amounts exceeding $50,000 require dual-supervisor authorization and audit logging.", 0.88, f3, 150, 210),
            ("BR-007", "Multi-Currency FX Reconciliation", "Foreign currency policy conversions must cross-check central bank rate feeds with variance threshold under 0.05%.", 0.87, f5, 100, 165),
            ("BR-008", "Exception Queue Escalation Path", "Policy validation anomalies are routed to Tier-2 review with full stack context snapshot attached.", 0.85, f3, 220, 280),
        ]
    elif any(k in combined for k in ("fortran", ".f90", ".f77", "matrix", "scientific", "physic")):
        ext = ".f90"
        prefix = "fortran"
        f1, f2, f3, f4, f5 = (
            f"{prefix}/solver_main{ext}",
            f"{prefix}/math_kernel{ext}",
            f"{prefix}/convergence_check{ext}",
            f"{prefix}/boundary_conditions{ext}",
            f"{prefix}/state_monitor{ext}",
        )
        rules = [
            ("BR-001", "Validate Parameter Thresholds in Simulation Routine", "Check input vector bounds against pre-calculated boundary matrices before matrix decomposition.", 0.95, f1, 12, 40),
            ("BR-002", "Compute Mathematical Parity & Matrix Inversion", "Execute double-precision matrix inversion and verify determinant non-zero compliance.", 0.93, f2, 55, 110),
            ("BR-003", "Flag Iterative Convergence Discrepancies", "Raise floating-point exception if convergence residual exceeds tolerance parameter 1e-6.", 0.90, f3, 88, 132),
            ("BR-004", "Enforce Boundary Condition Safeguards", "Enforce physical stability boundaries across multi-grid iterations prior to output logging.", 0.92, f4, 22, 68),
            ("BR-005", "Monitor Output Data Anomalies", "Log state vector drift values exceeding 3-sigma variance to audit diagnostic file.", 0.88, f5, 15, 52),
            ("BR-006", "Validate Floating-Point Precision Bounds", "Enforce IEEE 754 double precision bounds on numerical integration kernels.", 0.87, f2, 115, 170),
            ("BR-007", "Reconcile Mesh State Variables", "Verify conservation of mass and energy across contiguous grid boundaries.", 0.86, f4, 75, 125),
            ("BR-008", "Exception Diagnostic Dump", "Dump current floating point register states upon numerical overflow condition.", 0.84, f3, 140, 195),
        ]
    elif any(k in combined for k in ("cobol", "cics", "vsam", "jcl", "copybook", "pds", "mainframe", "pl/i", "assembler")):
        ext = ".cbl"
        prefix = "cobol"
        f1, f2, f3, f4, f5 = (
            f"{prefix}/ACCT_VAL{ext}",
            f"{prefix}/CALC_INT{ext}",
            "jcl/NIGHTLY_RECON.jcl",
            f"{prefix}/XFER_AUDIT{ext}",
            f"{prefix}/AUDIT_LOGGER{ext}",
        )
        rules = [
            ("BR-001", "Validate Customer Account Status in CICS Online", "Verify ACCT-STATUS = 'ACTV' and check balance sufficiency before approving withdrawal transaction.", 0.97, f1, 120, 165),
            ("BR-002", "Calculate Interest Rate and Finance Charges", "Compute monthly interest = ACCT-BALANCE * (ANNUAL-RATE / 12) using COPYBOOK CPY-ACCT-REC.", 0.95, f2, 85, 140),
            ("BR-003", "Process Nightly Batch Reconciliations via JCL", "Reconcile VSAM master file records with daily transaction log feeds during batch cycle.", 0.92, f3, 15, 70),
            ("BR-004", "Audit High-Value Transfer Limits", "Flag transactions exceeding $50,000 for secondary supervisor approval in CICS.", 0.94, f4, 200, 260),
            ("BR-005", "Enforce Regulatory Audit Trail Logging", "Write all account modifications to SOX compliant audit dataset with timestamp and operator ID.", 0.90, f5, 40, 98),
            ("BR-006", "Validate Copybook Schema Consistency", "Ensure 01-level record layouts match VSAM file physical record lengths.", 0.89, f2, 145, 190),
            ("BR-007", "CICS Timeout and Lock Handling", "Release record locks after 5 seconds of inactivity to prevent batch job contention.", 0.87, f1, 170, 215),
            ("BR-008", "Batch File EOF Reconciliation", "Verify control record count matches trailer record count at end of batch processing.", 0.85, f3, 75, 120),
        ]
    elif any(k in combined for k in ("db2", "oracle", "sql", "postgres", "database", "schema")):
        ext = ".sql"
        prefix = "database"
        f1, f2, f3, f4, f5 = (
            f"{prefix}/schema_constraints{ext}",
            f"{prefix}/sp_calc_interest{ext}",
            f"{prefix}/etl_quarantine{ext}",
            f"{prefix}/pii_security_views{ext}",
            f"{prefix}/daily_summary_proc{ext}",
        )
        rules = [
            ("BR-001", "Enforce Referential Integrity and Foreign Key Constraints", "Validate customer account foreign key before inserting transaction ledger records.", 0.96, f1, 10, 45),
            ("BR-002", "Calculate Automated Interest Accrual via Stored Procedure", "Execute stored procedure SP_CALC_INTEREST to update active accounts at end-of-day.", 0.94, f2, 30, 90),
            ("BR-003", "Audit Exception Records and Staging Variances", "Route failed ETL transformation rows into quarantine table for manual reconciliation.", 0.91, f3, 65, 115),
            ("BR-004", "Enforce PII Encryption and Masking Regulations", "Apply column-level encryption on SSN and account numbers prior to persistence.", 0.93, f4, 15, 60),
            ("BR-005", "Reconcile Daily Transaction Totals", "Compare summary ledger table totals against raw event log tables.", 0.89, f5, 80, 140),
            ("BR-006", "Validate Database Cutover Sync", "Cross-check dual-write database triggers during active cutover window.", 0.88, f2, 95, 150),
            ("BR-007", "Audit Trail Triggers on Sensitive Columns", "Fire audit trigger on any update to customer credit limits or SSN columns.", 0.87, f4, 65, 110),
            ("BR-008", "Deadlock Retry Procedures", "Retry transaction commit up to 3 times upon database deadlock exception.", 0.85, f3, 120, 160),
        ]
    else:
        safe_name = "".join(c if c.isalnum() else "_" for c in title.lower()[:20]).strip("_") or "app"
        ext = ".java" if "java" in combined else (".py" if "python" in combined else ".cbl")
        prefix = "src"
        f1, f2, f3, f4, f5 = (
            f"{prefix}/{safe_name}_validator{ext}",
            f"{prefix}/{safe_name}_calculator{ext}",
            f"{prefix}/{safe_name}_audit{ext}",
            f"{prefix}/{safe_name}_compliance{ext}",
            f"{prefix}/{safe_name}_service{ext}",
        )
        rules = [
            ("BR-001", f"Validate {title or 'Estate'} Requirement Rules", f"Enforce input validation rules derived from {req or 'business requirements'} during payload processing.", 0.95, f1, 15, 50),
            ("BR-002", f"Calculate Domain Metrics for {title or 'Application'}", "Compute primary financial and operational calculation formulas prior to state persistence.", 0.93, f2, 35, 90),
            ("BR-003", "Flag Exception Records and Boundary Variances", "Route out-of-bounds transaction parameters into exception review queues.", 0.91, f3, 60, 110),
            ("BR-004", "Enforce Security & Compliance Controls", "Enforce zero-trust authorization checks and PII data masking guidelines.", 0.94, f4, 20, 75),
            ("BR-005", "Reconcile System State & Execution Logs", "Cross-validate target microservice responses against legacy baseline outputs.", 0.89, f5, 45, 105),
            ("BR-006", "Validate Data Model Parity", "Check entity property structures against canonical domain model specs.", 0.88, f1, 55, 95),
            ("BR-007", "High-Volume Rate Limiting Safeguard", "Throttle burst execution requests when queue depth exceeds 1,000 items.", 0.86, f5, 110, 155),
            ("BR-008", "Audit Event Publication", "Publish structured audit events upon completion of state modification workflows.", 0.85, f3, 115, 160),
        ]

    out = []
    for r in rules:
        out.append({
            "rule_id": r[0],
            "title": r[1],
            "statement": r[2],
            "confidence": r[3],
            "path": r[4],
            "start": r[5],
            "end": r[6],
        })
    return out


def a6_form_profile(
    category_id: str,
    project_name: str = "",
    requirement: str = "",
    code_location: str = "",
    strategies: list[str] | None = None,
) -> dict[str, Any]:
    """Category-shaped A6 Business Rule Extraction form + sample rule templates."""
    shared_confidence = {
        "label": "How certain must the factory be before accepting a rule on its own?",
        "hint": "Anything less certain goes to a human expert.",
        "options": [
            ["0.8", "Fairly certain — balanced (80%)"],
            ["0.9", "Very certain — more human checking (90%)"],
            ["0.7", "Loosely certain — faster, riskier (70%)"],
        ],
        "suggested": "0.8",
    }
    shared_scope = {
        "label": "What kinds of business rules should we extract?",
        "hint": "Stay close to what the prior agent already mapped.",
        "options": [
            ["pricing", "Pricing / interest / fees"],
            ["eligibility", "Eligibility and underwriting"],
            ["lifecycle", "Account / policy lifecycle"],
            ["exceptions", "Exception and override paths"],
            ["compliance", "Regulatory and control checks"],
        ],
        "suggested": ["pricing", "eligibility", "lifecycle"],
    }
    cite = {
        "label": "Requirements for every rule",
        "hint": "Citations keep rules auditable.",
        "options": [["cite", "Must point to the exact code lines it came from"]],
        "suggested": ["cite"],
    }

    def _rules(*rows: tuple) -> list[dict[str, Any]]:
        out = []
        for row in rows:
            rid, title, statement, conf, path, start, end = row
            out.append(
                {
                    "rule_id": rid,
                    "title": title,
                    "statement": statement,
                    "confidence": conf,
                    "path": path,
                    "start": start,
                    "end": end,
                }
            )
        return out

    exact_extracted_rules = synthesize_repository_rules(
        project_name=project_name,
        requirement=requirement,
        code_location=code_location,
        category_id=category_id,
        strategies=strategies,
    )
    banking = exact_extracted_rules

    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Business rule extraction",
            "lede": (
                "The most important agent — reads the old code and figures out the real business logic. "
                "Not 'what does the code do' but 'what is the business trying to achieve'."
            ),
            "form_heading": "Set the extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence},
            "scope": {**shared_scope, "suggested": ["pricing", "eligibility", "lifecycle", "exceptions"]},
            "citation": cite,
            "result_banner": {
                "headline": "The most important step is done.",
                "body": (
                    "We extracted the real business logic from the code — not what the code does technically, "
                    "but what the business is trying to achieve."
                ),
            },
            "sample_heading": "EXACT BUSINESS RULES EXTRACTED",
            "sample_rules": banking,
            "total_rules": 8,
            "review_count": 2,
        },
        "database": {
            "title": "Business rule extraction · data constraints",
            "lede": "Turns schema checks, triggers, and host-variable guards into plain-English business rules.",
            "form_heading": "Set the data-rule extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence, "suggested": "0.9"},
            "scope": {
                **shared_scope,
                "options": [
                    ["integrity", "Referential and balance integrity"],
                    ["masking", "PII / masking gates"],
                    ["lifecycle", "Record lifecycle and archival"],
                    ["exceptions", "Exception and override paths"],
                    ["compliance", "Regulatory and control checks"],
                ],
                "suggested": ["integrity", "lifecycle", "compliance"],
            },
            "citation": cite,
            "result_banner": {
                "headline": "Data business rules extracted.",
                "body": "Constraints and guards from the structural map are now stated as business decisions with citations.",
            },
            "sample_rules": exact_extracted_rules,
            "total_rules": 142,
            "review_count": 14,
        },
        "interfaces": {
            "title": "Business rule extraction · channel contracts",
            "lede": "Extracts partner and channel decision rules from adapter programs mapped earlier.",
            "form_heading": "Set the interface-rule extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence},
            "scope": {
                **shared_scope,
                "suggested": ["eligibility", "exceptions", "compliance"],
            },
            "citation": cite,
            "result_banner": {
                "headline": "Channel business rules extracted.",
                "body": "Accept/reject and fee decisions on partner paths are now plain English with source citations.",
            },
            "sample_rules": exact_extracted_rules,
            "total_rules": 96,
            "review_count": 11,
        },
        "business_docs": {
            "title": "Business rule extraction · from documents and code",
            "lede": "Aligns BRD/SOP language with the programs discovery and analysis already found.",
            "form_heading": "Set the document-linked extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence, "suggested": "0.8"},
            "scope": {
                **shared_scope,
                "suggested": ["pricing", "eligibility", "lifecycle"],
            },
            "citation": cite,
            "result_banner": {
                "headline": "Document-backed business rules extracted.",
                "body": "Rules from BRDs and code comments are merged into one catalogue with citations.",
            },
            "sample_rules": banking,
            "total_rules": 120,
            "review_count": 22,
        },
        "transactions": {
            "title": "Business rule extraction · posting decisions",
            "lede": "Captures the money-path decisions inside posting and settlement programs.",
            "form_heading": "Set the posting-rule extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence, "suggested": "0.9"},
            "scope": {
                **shared_scope,
                "suggested": ["pricing", "exceptions", "lifecycle", "compliance"],
            },
            "citation": cite,
            "result_banner": {
                "headline": "Posting business rules extracted.",
                "body": "Interest, overdraft, and settlement decisions are now stated in plain English with proof lines.",
            },
            "sample_rules": banking,
            "total_rules": 187,
            "review_count": 18,
        },
        "tests": {
            "title": "Business rule extraction · characterization targets",
            "lede": "Produces the decision rules golden tests must prove equivalent after rewrite.",
            "form_heading": "Set the test-facing extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence},
            "scope": {**shared_scope, "suggested": ["pricing", "exceptions", "lifecycle"]},
            "citation": cite,
            "result_banner": {
                "headline": "Testable business rules extracted.",
                "body": "High-value decisions are catalogued so characterization suites can lock behaviour.",
            },
            "sample_rules": banking,
            "total_rules": 110,
            "review_count": 15,
        },
        "defects": {
            "title": "Business rule extraction · defect hotspots",
            "lede": "Focuses extraction on programs that keep failing — the decisions that bite operations.",
            "form_heading": "Set the hotspot extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence, "suggested": "0.8"},
            "scope": {**shared_scope, "suggested": ["exceptions", "eligibility", "compliance"]},
            "citation": cite,
            "result_banner": {
                "headline": "Hotspot business rules extracted.",
                "body": "Ambiguous decisions behind recurring defects are surfaced for SME confirmation.",
            },
            "sample_rules": banking,
            "total_rules": 78,
            "review_count": 21,
        },
        "security": {
            "title": "Business rule extraction · control decisions",
            "lede": "Turns entitlement and sensitive-path branches into auditable business controls.",
            "form_heading": "Set the control-rule extraction lens",
            "domain_kicker": "Domain B · Understand the old code · Step A6",
            "confidence": {**shared_confidence, "suggested": "0.9"},
            "scope": {
                **shared_scope,
                "suggested": ["compliance", "eligibility", "exceptions"],
            },
            "citation": cite,
            "result_banner": {
                "headline": "Control business rules extracted.",
                "body": "Access and masking decisions are now plain English with citations for auditors.",
            },
            "sample_rules": exact_extracted_rules,
            "total_rules": 64,
            "review_count": 9,
        },
    }
    # Fallback for categories that rarely promote A6.
    for cid in ("configuration", "observability", "build_deploy", "target_state"):
        profiles[cid] = dict(profiles["legacy_source"])
        profiles[cid]["title"] = f"Business rule extraction · {cid.replace('_', ' ')}"
    return profiles.get(category_id) or profiles["legacy_source"]


def a7_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A7 Documentation & Knowledge Graph form + result seeds."""
    shared_artifacts = {
        "label": "What documentation should we produce?",
        "hint": "Stay close to what prior agents already discovered and extracted.",
        "options": [
            ["overview", "System overview"],
            ["modules", "Module / program docs"],
            ["diagrams", "Sequence diagrams"],
            ["dictionary", "Data dictionary"],
            ["runbooks", "Batch job runbooks"],
            ["confluence", "Publishable Confluence / wiki pages"],
        ],
        "suggested": ["overview", "modules", "diagrams", "dictionary"],
    }
    shared_publish = {
        "label": "Where should operators find the docs?",
        "hint": "Pick the channel that matches the A1 estate.",
        "options": [
            ["markdown", "Markdown artefacts in the factory vault"],
            ["confluence", "Confluence / wiki"],
            ["sharepoint", "SharePoint / document library"],
        ],
        "suggested": "markdown",
    }
    shared_depth = {
        "label": "How deep should documentation go?",
        "hint": "Deeper means more pages and denser knowledge-graph links.",
        "options": [
            ["summary", "Summary — executive overview only"],
            ["standard", "Standard — modules, diagrams, dictionary"],
            ["deep", "Deep — runbooks, full graph, publish pack"],
        ],
        "suggested": "standard",
    }
    banner = {
        "headline": "The old system now has proper documentation — often for the first time in decades.",
        "body": (
            "We wrote operator-facing docs and linked rules, modules, and tables into a "
            "knowledge graph that later gates can trust."
        ),
    }

    def _docs(
        overview: int,
        modules: int,
        diagrams: int,
        dictionary: int,
        runbooks: int,
        confluence: int,
    ) -> list[dict[str, Any]]:
        return [
            {"id": "overview", "label": "System overview", "value": overview, "unit": "pages"},
            {"id": "modules", "label": "Module docs", "value": modules, "unit": "files"},
            {"id": "diagrams", "label": "Sequence diagrams", "value": diagrams, "unit": "created"},
            {"id": "dictionary", "label": "Data dictionary", "value": dictionary, "unit": "tables"},
            {"id": "runbooks", "label": "Batch job runbooks", "value": runbooks, "unit": "procedures"},
            {"id": "confluence", "label": "Confluence pages", "value": confluence, "unit": "published"},
        ]

    def _kg(
        nodes: int,
        relationships: int,
        rules_linked: int,
        rules_total: int,
        modules_linked: int,
        modules_total: int,
        conflicts: int,
    ) -> dict[str, Any]:
        return {
            "nodes": nodes,
            "relationships": relationships,
            "rules_linked": rules_linked,
            "rules_total": rules_total,
            "modules_linked": modules_linked,
            "modules_total": modules_total,
            "conflicts": conflicts,
        }

    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Documentation & Knowledge Graph",
            "lede": (
                "Writes fresh, accurate documentation for the old system — often for the "
                "first time in decades — and links it into a knowledge graph."
            ),
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "modules", "diagrams", "dictionary", "runbooks"],
            },
            "publish": {**shared_publish, "suggested": "markdown"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "documents": _docs(34, 247, 89, 148, 63, 581),
            "knowledge_graph": _kg(12847, 89412, 187, 187, 239, 247, 7),
        },
        "business_docs": {
            "title": "Documentation & Knowledge Graph",
            "lede": (
                "Turns BRDs, SOPs, and policy manuals into living documentation and a "
                "searchable knowledge graph for operators and G1 reviewers."
            ),
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "dictionary", "confluence", "diagrams"],
            },
            "publish": {**shared_publish, "suggested": "sharepoint"},
            "depth": {**shared_depth, "suggested": "deep"},
            "result_banner": {
                "headline": "Business documentation is now linked and publishable.",
                "body": (
                    "Policy manuals and BRDs are connected to code and tables so knowledge "
                    "no longer lives only in SharePoint folders."
            ),
            },
            "documents": _docs(28, 96, 42, 64, 18, 312),
            "knowledge_graph": _kg(6420, 28110, 96, 96, 88, 96, 4),
        },
        "database": {
            "title": "Documentation & Knowledge Graph",
            "lede": (
                "Documents schemas, table lineages, and batch jobs, then links modules to "
                "tables in the knowledge graph."
            ),
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "dictionary", "runbooks", "diagrams"],
            },
            "publish": {**shared_publish, "suggested": "markdown"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": {
                "headline": "Data estate documentation is ready for operators.",
                "body": "Tables, batch jobs, and module links are documented with conflict flags for SME review.",
            },
            "documents": _docs(22, 180, 55, 312, 91, 240),
            "knowledge_graph": _kg(15400, 102200, 140, 140, 172, 180, 9),
        },
        "configuration": {
            "title": "Documentation & Knowledge Graph",
            "lede": "Captures configuration estates as operator docs and a graph of parameter → consumer links.",
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "modules", "dictionary", "confluence"],
            },
            "publish": {**shared_publish, "suggested": "confluence"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "documents": _docs(18, 120, 31, 88, 24, 190),
            "knowledge_graph": _kg(5100, 22100, 72, 72, 110, 120, 5),
        },
        "interfaces": {
            "title": "Documentation & Knowledge Graph",
            "lede": "Documents partner interfaces and sequence flows, then graphs contract → module links.",
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "diagrams", "modules", "confluence"],
            },
            "publish": {**shared_publish, "suggested": "confluence"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "documents": _docs(26, 140, 112, 70, 20, 260),
            "knowledge_graph": _kg(7800, 45200, 110, 110, 128, 140, 6),
        },
        "observability": {
            "title": "Documentation & Knowledge Graph",
            "lede": "Writes runbooks and telemetry maps from runtime signals into an operator knowledge graph.",
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "runbooks", "diagrams", "confluence"],
            },
            "publish": {**shared_publish, "suggested": "confluence"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "documents": _docs(16, 64, 48, 40, 88, 150),
            "knowledge_graph": _kg(4200, 19800, 54, 54, 58, 64, 3),
        },
        "build_deploy": {
            "title": "Documentation & Knowledge Graph",
            "lede": "Documents pipelines, deploy runbooks, and release graphs for the build estate.",
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "runbooks", "diagrams", "modules"],
            },
            "publish": {**shared_publish, "suggested": "markdown"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "documents": _docs(20, 88, 36, 32, 74, 120),
            "knowledge_graph": _kg(3600, 15400, 40, 40, 80, 88, 4),
        },
        "target_state": {
            "title": "Documentation & Knowledge Graph",
            "lede": "Captures target-state architecture docs and a graph that bridges legacy → target.",
            "form_heading": "Set the documentation lens",
            "domain_kicker": "Domain B · Understand the old code · Step A7",
            "artifacts": {
                **shared_artifacts,
                "suggested": ["overview", "diagrams", "dictionary", "confluence"],
            },
            "publish": {**shared_publish, "suggested": "confluence"},
            "depth": {**shared_depth, "suggested": "deep"},
            "result_banner": banner,
            "documents": _docs(40, 160, 96, 110, 40, 400),
            "knowledge_graph": _kg(9100, 52000, 160, 160, 150, 160, 8),
        },
    }
    for cid in ("transactions", "tests", "defects", "security"):
        profiles[cid] = dict(profiles["legacy_source"])
        profiles[cid]["title"] = "Documentation & Knowledge Graph"
        profiles[cid]["artifacts"] = {
            **shared_artifacts,
            "suggested": ["overview", "modules", "diagrams", "dictionary"],
        }
    return profiles.get(category_id) or profiles["legacy_source"]


def a9_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A9 Domain Decomposition form + result seeds."""
    shared_shape = {
        "label": "What shape should the new system be?",
        "hint": "Align cuts with the A1 modernization strategy and approved rules.",
        "options": [
            ["micro", "Separate independent pieces — most flexible, more to run"],
            ["modular", "One application with clear internal walls — simpler"],
            ["hybrid", "Split only the busiest parts, leave the rest"],
        ],
        "suggested": "modular",
    }
    shared_order = {
        "label": "Which piece should we build first?",
        "hint": "Safer first slices reduce production risk during strangler / cutover.",
        "options": [
            ["safe", "The lowest-risk piece"],
            ["value", "The piece the business cares about most"],
            ["small", "The smallest piece, for a fast visible result"],
        ],
        "suggested": "safe",
    }
    banner = {
        "headline": "This is a proposal. A person decides at the next gate.",
        "body": (
            "Bounded contexts are scored for cohesion and coupling. "
            "Architecture (A10) and Gate G2 turn this proposal into an approved design."
        ),
    }
    checklist = [
        ["cuts_ok", "Confirm decomposition cuts align with the modernization strategy"],
        ["scope_ok", "Confirm bounded contexts cover the A1 requirement scope"],
        ["order_ok", "Confirm strangler / slice order is safe for production"],
    ]

    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Domain decomposition",
            "lede": (
                "Proposes service or module boundaries from measured dependencies "
                "and approved rules — foundational for strangler/slice strategies."
            ),
            "form_heading": "Set the decomposition shape",
            "domain_kicker": "Domain D · Design & build the new · Step A9",
            "shape": {**shared_shape, "suggested": "modular"},
            "order": {**shared_order, "suggested": "safe"},
            "result_banner": banner,
            "checklist_templates": checklist,
            "candidate_services": [
                ["Core compute", "Replaces dense calculation / batch cores", ["CORE", "BATCH"]],
                ["Pricing / rates", "Works out rates and premiums", ["RATE", "PREM"]],
                ["Rules engine", "Business rule decisions", ["RULE", "VALID"]],
                ["Documents", "Letters and schedules", ["DOC", "PRINT"]],
                ["Reference data", "Shared lookup tables", ["REF", "CODE"]],
                ["Integration hub", "External and partner I/O", ["IFACE", "IO"]],
            ],
        },
        "database": {
            "title": "Domain decomposition",
            "lede": "Proposes data-owning bounded contexts from table ownership and access patterns.",
            "form_heading": "Set the decomposition shape",
            "domain_kicker": "Domain D · Design & build the new · Step A9",
            "shape": {**shared_shape, "suggested": "micro"},
            "order": {**shared_order, "suggested": "safe"},
            "result_banner": banner,
            "checklist_templates": checklist,
            "candidate_services": [
                ["Master data", "Owns customer / policy masters", ["MAST"]],
                ["Transactional write", "Owns write paths and journals", ["TXN"]],
                ["Read models", "Query and reporting slices", ["RPT"]],
                ["Reference data", "Codes and lookups", ["REF"]],
            ],
        },
        "interfaces": {
            "title": "Domain decomposition",
            "lede": "Proposes partner-facing and internal pieces from measured interface traffic.",
            "form_heading": "Set the decomposition shape",
            "domain_kicker": "Domain D · Design & build the new · Step A9",
            "shape": {**shared_shape, "suggested": "hybrid"},
            "order": {**shared_order, "suggested": "value"},
            "result_banner": banner,
            "checklist_templates": checklist,
            "candidate_services": [
                ["Partner gateway", "External partner protocols", ["PGW"]],
                ["Internal APIs", "Service-to-service calls", ["IAPI"]],
                ["File exchange", "Batch file bridges", ["FILE"]],
                ["Message routing", "Queues and topics", ["MQ"]],
            ],
        },
        "business_docs": {
            "title": "Domain decomposition",
            "lede": "Proposes process-aligned bounded contexts from documented journeys and rules.",
            "form_heading": "Set the decomposition shape",
            "domain_kicker": "Domain D · Design & build the new · Step A9",
            "shape": shared_shape,
            "order": shared_order,
            "result_banner": banner,
            "checklist_templates": checklist,
            "candidate_services": [
                ["Intake", "Case / application intake", ["INTAKE"]],
                ["Decisioning", "Underwriting / eligibility", ["DECIDE"]],
                ["Fulfilment", "Downstream fulfilment", ["FULFIL"]],
                ["Correspondence", "Customer letters", ["CORR"]],
            ],
        },
    }
    for cid in ("configuration", "observability", "build_deploy", "transactions", "tests", "defects", "security"):
        profiles[cid] = dict(profiles["legacy_source"])
    return profiles.get(category_id) or profiles["legacy_source"]


def a10_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A10 Target Architecture form + design/contract seeds."""
    shared_comms = {
        "label": "How should the pieces talk to each other?",
        "hint": "Stay continuous with A9 boundaries and the A1 modernization strategy.",
        "options": [
            ["sync", "Direct calls — simpler to follow"],
            ["async", "Messages — more resilient, harder to debug"],
            ["mixed", "Direct for queries, messages for updates"],
        ],
        "suggested": "mixed",
    }
    shared_depth = {
        "label": "How deep should contracts go?",
        "hint": "Deeper means more OpenAPI operations, events, and ADRs per service.",
        "options": [
            ["standard", "Standard — core APIs and events per bounded context"],
            ["deep", "Deep — full surface area, ownership rules, ADR pack"],
        ],
        "suggested": "standard",
    }
    banner = {
        "headline": "Target design ready.",
        "body": (
            "Every new service now has a specification — how it talks to others, "
            "what data it owns, how it authenticates."
        ),
    }

    def _choices(
        sync_api: str,
        async_msg: str,
        auth: str,
        idempotency: str,
        observability: str,
    ) -> list[dict[str, str]]:
        return [
            {"label": "Sync API style", "value": sync_api},
            {"label": "Async messaging", "value": async_msg},
            {"label": "Authentication", "value": auth},
            {"label": "Idempotency", "value": idempotency},
            {"label": "Observability", "value": observability},
        ]

    def _contracts(rest: int, events: int, ownership: int, adrs: int) -> list[dict[str, Any]]:
        return [
            {"id": "rest", "label": "REST endpoints", "value": rest, "unit": ""},
            {"id": "events", "label": "Event contracts", "value": events, "unit": ""},
            {"id": "ownership", "label": "Data ownership rules", "value": ownership, "unit": "tables mapped"},
            {"id": "adrs", "label": "Architecture decisions", "value": adrs, "unit": "documented"},
        ]

    previous_default = {
        "headline": "As-is architecture captured.",
        "body": (
            "The current estate still runs as a tightly coupled legacy system — shared data, "
            "implicit calls, and little explicit contract coverage."
        ),
        "design_traits": [
            {"label": "System shape", "value": "Monolith / tightly coupled"},
            {"label": "Integration style", "value": "Direct CALL + batch files"},
            {"label": "Authentication", "value": "Platform / shared credentials"},
            {"label": "Data ownership", "value": "Shared tables & copybooks"},
            {"label": "Observability", "value": "Job logs only"},
        ],
        "estate_metrics": [
            {"id": "programs", "label": "Programs / modules", "value": 0, "unit": ""},
            {"id": "interfaces", "label": "Batch / interface points", "value": 0, "unit": ""},
            {"id": "ownership", "label": "Shared data layouts", "value": 0, "unit": "copybooks / tables"},
            {"id": "adrs", "label": "Documented decisions", "value": 0, "unit": "on record"},
        ],
    }

    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Target Architecture",
            "lede": "Designs the new architecture — how the small services will talk to each other.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "mixed"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "previous_architecture": previous_default,
            "design_choices": _choices(
                "REST + OpenAPI",
                "Kafka events",
                "OAuth 2.0 + mTLS",
                "Request-ID header",
                "OpenTelemetry",
            ),
            "contracts_generated": _contracts(47, 23, 148, 32),
        },
        "business_docs": {
            "title": "Target Architecture",
            "lede": "Turns approved domain cuts into service contracts operators and builders can obey.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "sync"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "previous_architecture": {
                **previous_default,
                "design_traits": [
                    {"label": "System shape", "value": "Document / process silos"},
                    {"label": "Integration style", "value": "Manual hand-offs + shared folders"},
                    {"label": "Authentication", "value": "SharePoint / intranet auth"},
                    {"label": "Data ownership", "value": "Scattered policy manuals"},
                    {"label": "Observability", "value": "Version history only"},
                ],
            },
            "design_choices": _choices(
                "REST + OpenAPI",
                "Domain events (light)",
                "OAuth 2.0",
                "Idempotency-Key",
                "Structured audit logs",
            ),
            "contracts_generated": _contracts(28, 12, 64, 18),
        },
        "database": {
            "title": "Target Architecture",
            "lede": "Designs data-owning services and the APIs/events that protect table ownership.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "async"},
            "depth": {**shared_depth, "suggested": "deep"},
            "result_banner": banner,
            "previous_architecture": {
                **previous_default,
                "design_traits": [
                    {"label": "System shape", "value": "Shared database monolith"},
                    {"label": "Integration style", "value": "Direct SQL + batch ETL"},
                    {"label": "Authentication", "value": "DB credentials / OS auth"},
                    {"label": "Data ownership", "value": "Cross-cutting table access"},
                    {"label": "Observability", "value": "DB audit / job logs"},
                ],
            },
            "design_choices": _choices(
                "REST + OpenAPI",
                "CDC + Kafka events",
                "OAuth 2.0 + mTLS",
                "Request-ID + outbox",
                "OpenTelemetry",
            ),
            "contracts_generated": _contracts(36, 41, 312, 28),
        },
        "configuration": {
            "title": "Target Architecture",
            "lede": "Designs config-owning services and safe sync/async contracts for parameter consumers.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "sync"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "previous_architecture": previous_default,
            "design_choices": _choices(
                "REST + OpenAPI",
                "Config-change events",
                "mTLS service identity",
                "Request-ID header",
                "OpenTelemetry",
            ),
            "contracts_generated": _contracts(22, 15, 88, 16),
        },
        "interfaces": {
            "title": "Target Architecture",
            "lede": "Designs partner-facing APIs and internal events that keep interface agreements explicit.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "mixed"},
            "depth": {**shared_depth, "suggested": "deep"},
            "result_banner": banner,
            "previous_architecture": {
                **previous_default,
                "design_traits": [
                    {"label": "System shape", "value": "Point-to-point interfaces"},
                    {"label": "Integration style", "value": "Flat files / MQ / FTP"},
                    {"label": "Authentication", "value": "Partner keys / certificates"},
                    {"label": "Data ownership", "value": "Shared interchange formats"},
                    {"label": "Observability", "value": "Transmission logs"},
                ],
            },
            "design_choices": _choices(
                "REST + OpenAPI",
                "Kafka + partner callbacks",
                "OAuth 2.0 + mTLS",
                "Idempotency-Key",
                "OpenTelemetry",
            ),
            "contracts_generated": _contracts(58, 34, 96, 40),
        },
        "observability": {
            "title": "Target Architecture",
            "lede": "Designs telemetry-first service contracts with explicit auth and correlation rules.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "async"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "previous_architecture": previous_default,
            "design_choices": _choices(
                "REST + OpenAPI",
                "Kafka telemetry bus",
                "mTLS",
                "Trace-parent + Request-ID",
                "OpenTelemetry",
            ),
            "contracts_generated": _contracts(24, 38, 40, 22),
        },
        "build_deploy": {
            "title": "Target Architecture",
            "lede": "Designs deployable service boundaries and the contracts CI/CD and bridges must obey.",
            "form_heading": "Set the communication style",
            "domain_kicker": "Domain D · Design & build the new · Step A10",
            "comms": {**shared_comms, "suggested": "mixed"},
            "depth": {**shared_depth, "suggested": "standard"},
            "result_banner": banner,
            "previous_architecture": previous_default,
            "design_choices": _choices(
                "REST + OpenAPI",
                "Kafka events",
                "OAuth 2.0 + mTLS",
                "Request-ID header",
                "OpenTelemetry",
            ),
            "contracts_generated": _contracts(40, 20, 110, 26),
        },
    }
    for cid in ("transactions", "tests", "defects", "security"):
        profiles[cid] = dict(profiles["legacy_source"])
    return profiles.get(category_id) or profiles["legacy_source"]


def a12_form_profile(category_id: str) -> dict[str, Any]:
    """Category-shaped A12 Code Generation form + result seeds."""
    shared_stack = {
        "label": "What should the new code be written in?",
        "hint": "Match the approved target architecture and A1 modernization strategy.",
        "options": [
            ["java", "Java — Spring Boot / OpenAPI services"],
            ["dotnet", ".NET — ASP.NET Core services"],
            ["python", "Python — FastAPI / service mesh friendly"],
        ],
        "suggested": "java",
    }
    shared_extras = {
        "label": "What else should be produced?",
        "hint": "Provenance is strongly recommended before Gate G3.",
        "options": [
            ["provenance", "A note on every method naming the rule it implements", "Strongly recommended"],
            ["infra", "Packaging and deployment files", ""],
        ],
        "suggested": ["provenance", "infra"],
    }
    banner = {
        "headline": "Code exists but is not trusted yet.",
        "body": (
            "Services were generated from approved architecture and rules. "
            "Testing and equivalence come next — nothing merges until humans approve."
        ),
    }
    checklist = [
        ["stack_ok", "Confirm generation stack matches the approved target architecture"],
        ["trace_ok", "Confirm every generated unit traces to an approved rule"],
        ["prov_ok", "Confirm provenance is on before G3 approval"],
    ]

    profiles: dict[str, dict[str, Any]] = {
        "legacy_source": {
            "title": "Code generation",
            "lede": (
                "Generates new services from approved architecture and rules; "
                "every method traces to an approved business rule."
            ),
            "form_heading": "Choose stack and extras",
            "domain_kicker": "Domain D · Design & build the new · Step A12",
            "stack": {**shared_stack, "suggested": "java"},
            "extras": shared_extras,
            "result_banner": banner,
            "checklist_templates": checklist,
            "metrics": [
                {"id": "services", "label": "Services built", "value": 0, "unit": ""},
                {"id": "files", "label": "Source files", "value": 0, "unit": ""},
                {"id": "rule_methods", "label": "Rule methods", "value": 0, "unit": ""},
                {"id": "security", "label": "Security findings", "value": 0, "unit": "blocking"},
            ],
        },
        "database": {
            "title": "Code generation",
            "lede": "Generates data-owning services that protect table ownership rules approved at G2.",
            "form_heading": "Choose stack and extras",
            "domain_kicker": "Domain D · Design & build the new · Step A12",
            "stack": {**shared_stack, "suggested": "java"},
            "extras": shared_extras,
            "result_banner": banner,
            "checklist_templates": checklist,
            "metrics": [
                {"id": "services", "label": "Services built", "value": 0, "unit": ""},
                {"id": "files", "label": "Source files", "value": 0, "unit": ""},
                {"id": "rule_methods", "label": "Rule methods", "value": 0, "unit": ""},
                {"id": "security", "label": "Security findings", "value": 0, "unit": "blocking"},
            ],
        },
        "interfaces": {
            "title": "Code generation",
            "lede": "Generates partner-facing and internal services that obey approved interface contracts.",
            "form_heading": "Choose stack and extras",
            "domain_kicker": "Domain D · Design & build the new · Step A12",
            "stack": {**shared_stack, "suggested": "java"},
            "extras": shared_extras,
            "result_banner": banner,
            "checklist_templates": checklist,
            "metrics": [
                {"id": "services", "label": "Services built", "value": 0, "unit": ""},
                {"id": "files", "label": "Source files", "value": 0, "unit": ""},
                {"id": "rule_methods", "label": "Rule methods", "value": 0, "unit": ""},
                {"id": "security", "label": "Security findings", "value": 0, "unit": "blocking"},
            ],
        },
        "business_docs": {
            "title": "Code generation",
            "lede": "Generates process services from approved domain boundaries and documented rules.",
            "form_heading": "Choose stack and extras",
            "domain_kicker": "Domain D · Design & build the new · Step A12",
            "stack": shared_stack,
            "extras": shared_extras,
            "result_banner": banner,
            "checklist_templates": checklist,
            "metrics": [
                {"id": "services", "label": "Services built", "value": 0, "unit": ""},
                {"id": "files", "label": "Source files", "value": 0, "unit": ""},
                {"id": "rule_methods", "label": "Rule methods", "value": 0, "unit": ""},
                {"id": "security", "label": "Security findings", "value": 0, "unit": "blocking"},
            ],
        },
    }
    for cid in ("configuration", "observability", "build_deploy", "transactions", "tests", "defects", "security"):
        profiles[cid] = dict(profiles["legacy_source"])
    return profiles.get(category_id) or profiles["legacy_source"]

