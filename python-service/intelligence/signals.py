import re
from collections import defaultdict
from datetime import datetime, timezone

PUBLIC_SECTOR = re.compile(
    r"\b(municipal|city of|county of|state of|public sector|USAJobs|public works)\b",
    re.I,
)
NONPROFIT = re.compile(r"\b(nonprofit|non-profit|501\(c\)|foundation)\b", re.I)
CONSTRUCTION = re.compile(
    r"\b(construction|infrastructure|public works|transit|water|sewer|bridge|highway)\b",
    re.I,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def derive_external_signals(organizations: list[dict], jobs: list[dict]) -> list[dict]:
    signals: list[dict] = []
    job_index: dict[str, list[dict]] = defaultdict(list)

    for row in jobs:
        company = row.get("company") or row.get("name")
        if company:
            job_index[company].append(row)

    for org in organizations:
        name = org.get("name")
        if not name:
            continue

        org_jobs = job_index.get(name, [])
        job_count = org.get("job_count") or len(org_jobs) or 0
        location = org.get("location")
        org_type = org.get("org_type") or org.get("orgType")

        if job_count >= 3:
            signals.append(
                {
                    "organizationName": name,
                    "location": location,
                    "orgType": org_type,
                    "signalType": "capacity_expansion",
                    "title": f"{name} shows sustained hiring capacity",
                    "description": (
                        f"{job_count} active or recent listings suggest operational scaling "
                        "before individual roles are fully staffed."
                    ),
                    "source": "haymarket-intelligence",
                    "confidence": 0.68,
                    "score": min(55 + job_count * 6, 90),
                    "leadWeeks": 6,
                    "occurredAt": _now_iso(),
                    "externalId": f"intel:capacity:{name}",
                    "metadata": {"jobCount": job_count},
                }
            )

        if org_type == "Public Sector" or PUBLIC_SECTOR.search(name or ""):
            signals.append(
                {
                    "organizationName": name,
                    "location": location,
                    "orgType": org_type or "Public Sector",
                    "signalType": "public_infrastructure",
                    "title": f"{name} public-sector hiring window",
                    "description": (
                        "Public employers often post in waves after budget cycles, "
                        "permits, or capital project approvals."
                    ),
                    "source": "haymarket-intelligence",
                    "confidence": 0.62,
                    "score": 58,
                    "leadWeeks": 8,
                    "occurredAt": _now_iso(),
                    "externalId": f"intel:public:{name}",
                    "metadata": {"sector": "public"},
                }
            )

        if org_type == "Nonprofit" or NONPROFIT.search(name or ""):
            signals.append(
                {
                    "organizationName": name,
                    "location": location,
                    "orgType": org_type or "Nonprofit",
                    "signalType": "grant_cycle",
                    "title": f"{name} nonprofit staffing signal",
                    "description": (
                        "Mission-driven organizations often hire after grant awards "
                        "or program expansions — before roles hit mainstream boards."
                    ),
                    "source": "haymarket-intelligence",
                    "confidence": 0.58,
                    "score": 52,
                    "leadWeeks": 10,
                    "occurredAt": _now_iso(),
                    "externalId": f"intel:nonprofit:{name}",
                    "metadata": {"sector": "nonprofit"},
                }
            )

        combined_text = " ".join(
            [name or "", location or "", org_type or ""]
            + [str(j.get("title", "")) for j in org_jobs[:5]]
        )
        if CONSTRUCTION.search(combined_text):
            signals.append(
                {
                    "organizationName": name,
                    "location": location,
                    "orgType": org_type,
                    "signalType": "infrastructure_permit",
                    "title": f"Infrastructure labor demand near {name}",
                    "description": (
                        "Construction and public-works language detected — "
                        "often a 4–12 week lead indicator before peak hiring."
                    ),
                    "source": "haymarket-intelligence",
                    "confidence": 0.55,
                    "score": 64,
                    "leadWeeks": 8,
                    "occurredAt": _now_iso(),
                    "externalId": f"intel:infra:{name}",
                    "metadata": {"category": "infrastructure"},
                }
            )

    location_clusters: dict[str, set[str]] = defaultdict(set)
    for row in jobs:
        company = row.get("company")
        loc = (row.get("location") or "").split(",")[0].strip().lower()
        if company and loc:
            location_clusters[loc].add(company)

    for loc, companies in location_clusters.items():
        if len(companies) < 3:
            continue
        sample = sorted(companies)[:3]
        signals.append(
            {
                "organizationName": sample[0],
                "location": loc.title(),
                "orgType": None,
                "signalType": "regional_cluster",
                "title": f"Regional hiring cluster: {loc.title()}",
                "description": (
                    f"{len(companies)} labor-aligned employers active in {loc.title()} — "
                    "a market-level demand signal."
                ),
                "source": "haymarket-intelligence",
                "confidence": 0.7,
                "score": min(45 + len(companies) * 5, 80),
                "leadWeeks": 4,
                "occurredAt": _now_iso(),
                "externalId": f"intel:cluster:{loc}",
                "metadata": {"employers": len(companies), "region": loc},
            }
        )

    return signals
