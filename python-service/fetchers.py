import re
import html
import os
import time
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

load_dotenv()

COOP_KEYWORDS = re.compile(
    r"\b(co-?op|cooperative|worker[- ]owned|worker owned|democratic workplace)\b",
    re.I,
)
UNION_KEYWORDS = re.compile(
    r"\b(union|ibew|ufcw|seiu|afl-?cio|collective bargaining|journeyman|apprenticeship)\b",
    re.I,
)
NONPROFIT_KEYWORDS = re.compile(
    r"\b(nonprofit|non-profit|501\(c\)|foundation|charitable|public benefit|PBC|mission[- ]driven)\b",
    re.I,
)
PUBLIC_SECTOR_KEYWORDS = re.compile(
    r"\b(municipal|city of|county of|state of|public sector|civil service|USAJobs|public works)\b",
    re.I,
)
LABOR_ORG_KEYWORDS = re.compile(
    r"\b(worker center|labor organization|labor council|labor union|organizing director|campaign staff|apprenticeship program)\b",
    re.I,
)
BCORP_KEYWORDS = re.compile(
    r"\b(B Corp|B-Corp|certified B Corporation|benefit corporation|living wage employer)\b",
    re.I,
)
BCORP_STRICT_KEYWORDS = re.compile(
    r"\b(B Corp|B-Corp|certified B Corporation|benefit corporation)\b",
    re.I,
)
HAYMARKET_KEYWORDS = re.compile(
    r"\b("
    r"co-?op|cooperative|worker[- ]owned|union|ibew|ufcw|seiu|afl-?cio|"
    r"nonprofit|non-profit|501\(c\)|foundation|charitable|public benefit|PBC|"
    r"municipal|city of|county of|state of|public sector|civil service|USAJobs|public works|"
    r"worker center|labor organization|labor council|"
    r"B Corp|B-Corp|certified B Corporation|benefit corporation"
    r")\b",
    re.I,
)
EXCLUDE_KEYWORDS = re.compile(
    r"\b("
    r"defense contractor|government contractor|secret clearance|active clearance|"
    r"U\.S\. GOVERNMENT\. THIS POSITION|TOP SECRET|security clearance"
    r")\b",
    re.I,
)
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")
HTML_TAG_RE = re.compile(r"<[^>]+>")


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def strip_html(text: str) -> str:
    if not text:
        return ""
    parser = _TextExtractor()
    parser.feed(text)
    cleaned = " ".join(parser.parts)
    return re.sub(r"\s+", " ", html.unescape(cleaned)).strip()


def html_to_plain_description(text: str) -> str:
    if not text:
        return ""

    normalized = html.unescape(text)
    normalized = re.sub(r"<br\s*/?>", "\n", normalized, flags=re.I)
    normalized = re.sub(r"</(p|div|h[1-6]|li|tr)>", "\n\n", normalized, flags=re.I)
    normalized = re.sub(r"<li[^>]*>", "• ", normalized, flags=re.I)
    normalized = HTML_TAG_RE.sub("", normalized)
    normalized = re.sub(r"[ \t]+\n", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r" +", " ", normalized)

    paragraphs = [p.strip() for p in normalized.split("\n\n") if p.strip()]
    deduped: list[str] = []
    seen: set[str] = set()

    for paragraph in paragraphs:
        key = re.sub(r"\s+", " ", paragraph).lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(paragraph)

    return "\n\n".join(deduped).strip()


def merge_jobicy_description(excerpt: str, body: str) -> str:
    excerpt_plain = strip_html(excerpt)
    body_plain = html_to_plain_description(body)

    if not body_plain:
        return excerpt_plain
    if not excerpt_plain:
        return body_plain
    if body_plain.lower().startswith(excerpt_plain.lower()[:80]):
        return body_plain
    if excerpt_plain.lower() in body_plain.lower():
        return body_plain

    return html_to_plain_description(f"{excerpt} {body}")


def infer_job_type(title: str, company: str, description: str, default: str = "Nonprofit") -> str:
    blob = f"{title} {company} {description}"
    scores = {
        "Union": len(UNION_KEYWORDS.findall(blob)),
        "Co-op": len(COOP_KEYWORDS.findall(blob)),
        "Nonprofit": len(NONPROFIT_KEYWORDS.findall(blob)),
        "Public Sector": len(PUBLIC_SECTOR_KEYWORDS.findall(blob)),
        "Labor Organization": len(LABOR_ORG_KEYWORDS.findall(blob)),
        "B-Corp": len(BCORP_KEYWORDS.findall(blob)),
    }
    best_type, best_score = max(scores.items(), key=lambda item: item[1])
    if best_score > 0:
        if best_type == "B-Corp" and not BCORP_STRICT_KEYWORDS.search(blob):
            scores["B-Corp"] = 0
            best_type, best_score = max(scores.items(), key=lambda item: item[1])
            if best_score == 0:
                return default
        return best_type
    return default


def matches_haymarket_listing(title: str, company: str, description: str) -> bool:
    blob = f"{title} {company} {description}"
    if EXCLUDE_KEYWORDS.search(blob):
        return False
    return bool(HAYMARKET_KEYWORDS.search(blob))


def resolve_approval_status(job_type: str) -> str:
    return "pending" if job_type == "B-Corp" else "approved"


def format_idealist_salary(job: dict) -> Optional[str]:
    minimum = job.get("salaryMinimum")
    maximum = job.get("salaryMaximum")
    currency = job.get("salaryCurrency") or "USD"
    period = (job.get("salaryPeriod") or "YEAR").lower()

    if minimum and maximum:
        return f"{currency} {float(minimum):,.0f} - {float(maximum):,.0f} / {period}"
    if minimum:
        return f"{currency} {float(minimum):,.0f}+ / {period}"
    if job.get("salaryDetails"):
        return str(job["salaryDetails"])
    return None


def idealist_job_type(job: dict) -> str:
    org = job.get("org") or {}
    if org.get("isBCorp"):
        return "B-Corp"
    if org.get("isSocialEnterprise"):
        return "Co-op"
    return "Nonprofit"


def idealist_location(job: dict) -> str:
    location_type = job.get("locationType")
    if location_type == "REMOTE":
        return "Remote"
    address = job.get("address") or {}
    parts = [address.get("city"), address.get("stateCode"), address.get("country")]
    location = ", ".join(part for part in parts if part)
    return location or "United States"


def infer_category(title: str, description: str) -> str:
    blob = f"{title} {description}".lower()
    rules = [
        (r"engineer|developer|software|tech", "Technology"),
        (r"nurse|health|medical|clinical", "Healthcare"),
        (r"electrician|carpenter|plumber|trades|construction", "Skilled Trades"),
        (r"market|communications|outreach", "Marketing"),
        (r"food|baker|kitchen|culinary", "Food Service"),
        (r"teacher|education|tutor", "Education"),
        (r"manufactur|production|assembly", "Manufacturing"),
    ]
    for pattern, category in rules:
        if re.search(pattern, blob):
            return category
    return "Other"


def contact_from_url(url: str, company: str) -> str:
    if not url:
        return "jobs@unionjobboard.org"
    if url.startswith("mailto:"):
        return url.replace("mailto:", "").split("?")[0]
    try:
        host = urlparse(url).netloc.replace("www.", "")
        if host:
            return f"careers@{host}"
    except Exception:
        pass
    slug = re.sub(r"[^a-z0-9]", "", company.lower())[:20] or "jobs"
    return f"{slug}@unionjobboard.org"


def normalize_job(
    *,
    external_id: str,
    source: str,
    title: str,
    company: str,
    location: str,
    description: str,
    job_type: Optional[str] = None,
    category: Optional[str] = None,
    salary: Optional[str] = None,
    contact_email: Optional[str] = None,
    source_url: Optional[str] = None,
    published_at: Optional[str] = None,
    approval_status: Optional[str] = None,
) -> dict:
    clean_description = html_to_plain_description(description) if "<" in description else strip_html(description)
    clean_description = clean_description[:8000]
    resolved_type = job_type or infer_job_type(title, company, clean_description)
    return {
        "externalId": external_id,
        "source": source,
        "title": title.strip()[:200],
        "company": company.strip()[:200],
        "location": (location or "Remote").strip()[:200],
        "type": resolved_type,
        "description": clean_description or title,
        "category": category or infer_category(title, clean_description),
        "salary": salary,
        "contactEmail": contact_email or contact_from_url(source_url or "", company),
        "sourceUrl": source_url,
        "publishedAt": published_at,
        "approvalStatus": approval_status or resolve_approval_status(resolved_type),
    }


def fetch_usfwc_jobs(client: httpx.Client) -> list[dict]:
    jobs: list[dict] = []
    page = 1

    while page <= 5:
        response = client.get(
            "https://www.usworker.coop/wp-json/wp/v2/job-listings",
            params={"per_page": 100, "page": page, "status": "publish"},
            timeout=20,
        )
        if response.status_code != 200:
            break

        listings = response.json()
        if not listings:
            break

        for item in listings:
            meta = item.get("meta", {})
            if meta.get("_filled"):
                continue

            title = strip_html(item.get("title", {}).get("rendered", ""))
            company = meta.get("_company_name") or "Worker Cooperative"
            location = meta.get("_job_location") or ("Remote" if meta.get("_remote_position") else "United States")
            description = item.get("content", {}).get("rendered", "")
            application = meta.get("_application") or item.get("link", "")

            jobs.append(
                normalize_job(
                    external_id=f"usfwc-{item['id']}",
                    source="usfwc",
                    title=title,
                    company=company,
                    location=location,
                    description=description,
                    job_type="Co-op",
                    salary=meta.get("_job_salary"),
                    contact_email=contact_from_url(application, company),
                    source_url=application if application.startswith("http") else item.get("link"),
                )
            )

        page += 1

    return jobs


def fetch_jobicy_jobs(client: httpx.Client) -> list[dict]:
    response = client.get(
        "https://jobicy.com/api/v2/remote-jobs",
        params={"count": 50, "geo": "usa"},
        timeout=20,
    )
    if response.status_code != 200:
        return []

    jobs: list[dict] = []
    for item in response.json().get("jobs", []):
        title = item.get("jobTitle", "")
        company = item.get("companyName", "")
        description = merge_jobicy_description(
            item.get("jobExcerpt", ""),
            item.get("jobDescription", ""),
        )

        if not matches_haymarket_listing(title, company, description):
            continue

        salary = None
        if item.get("salaryMin") and item.get("salaryMax"):
            currency = item.get("salaryCurrency", "USD")
            period = item.get("salaryPeriod", "yearly")
            salary = f"{currency} {item['salaryMin']:,} - {item['salaryMax']:,} / {period}"

        jobs.append(
            normalize_job(
                external_id=f"jobicy-{item['id']}",
                source="jobicy",
                title=title,
                company=company,
                location=item.get("jobGeo", "Remote"),
                description=description,
                salary=salary,
                source_url=item.get("url"),
                published_at=item.get("publishedDate") or item.get("pubDate"),
            )
        )

    return jobs


def fetch_usajobs(client: httpx.Client) -> list[dict]:
    api_key = os.environ.get("USAJOBS_API_KEY")
    user_agent = os.environ.get("USAJOBS_USER_AGENT")
    if not api_key or not user_agent:
        return []

    jobs: list[dict] = []
    seen_ids: set[str] = set()
    keywords = ["union", "labor union", "civil service"]

    for keyword in keywords:
        for page in range(1, 3):
            response = client.get(
                "https://data.usajobs.gov/api/search",
                params={"Keyword": keyword, "ResultsPerPage": 25, "Page": page},
                headers={
                    "Host": "data.usajobs.gov",
                    "User-Agent": user_agent,
                    "Authorization-Key": api_key,
                },
                timeout=30,
            )
            if response.status_code != 200:
                break

            items = response.json().get("SearchResult", {}).get("SearchResultItems", [])
            if not items:
                break

            for item in items:
                descriptor = item.get("MatchedObjectDescriptor", {})
                object_id = item.get("MatchedObjectId") or descriptor.get("PositionID")
                if not object_id or object_id in seen_ids:
                    continue
                seen_ids.add(str(object_id))

                title = descriptor.get("PositionTitle", "")
                company = descriptor.get("OrganizationName", "U.S. Government")
                locations = descriptor.get("PositionLocationDisplay", [])
                location = locations[0] if locations else "United States"
                description = descriptor.get("QualificationSummary") or title
                uri_list = descriptor.get("PositionURI", [])
                source_url = uri_list[0] if uri_list else f"https://www.usajobs.gov/job/{object_id}"

                remuneration = descriptor.get("PositionRemuneration", [])
                salary = None
                if remuneration:
                    salary = remuneration[0].get("MinimumRange") or remuneration[0].get("Description")

                jobs.append(
                    normalize_job(
                        external_id=f"usajobs-{object_id}",
                        source="usajobs",
                        title=title,
                        company=company,
                        location=location,
                        description=description,
                        job_type="Public Sector",
                        salary=salary,
                        source_url=source_url,
                        published_at=descriptor.get("PublicationStartDate"),
                    )
                )

    return jobs


def fetch_idealist_jobs(client: httpx.Client) -> list[dict]:
    api_key = os.environ.get("IDEALIST_API_KEY")
    if not api_key:
        return []

    response = client.get(
        "https://www.idealist.org/api/v1/listings/jobs",
        headers={"Accept": "application/json"},
        auth=(api_key, ""),
        timeout=30,
    )
    if response.status_code != 200:
        return []

    summaries = response.json().get("jobs", [])[:25]
    jobs: list[dict] = []

    for summary in summaries:
        job_id = summary.get("id")
        if not job_id:
            continue

        detail_response = client.get(
            f"https://www.idealist.org/api/v1/listings/jobs/{job_id}",
            headers={"Accept": "application/json"},
            auth=(api_key, ""),
            timeout=30,
        )
        if detail_response.status_code != 200:
            continue

        job = detail_response.json().get("job", {})
        org = job.get("org") or {}
        title = job.get("name", "")
        company = org.get("name", "Nonprofit Organization")
        description = job.get("description") or title
        resolved_type = idealist_job_type(job)
        org_urls = org.get("url") or {}
        source_url = org_urls.get("en") or f"https://www.idealist.org/en/nonprofit-job/{job_id}"

        jobs.append(
            normalize_job(
                external_id=f"idealist-{job_id}",
                source="idealist",
                title=title,
                company=company,
                location=idealist_location(job),
                description=description,
                job_type=resolved_type,
                salary=format_idealist_salary(job),
                source_url=source_url,
                published_at=job.get("firstPublished") or job.get("updated"),
                approval_status=resolve_approval_status(resolved_type),
            )
        )
        time.sleep(0.15)

    return jobs


def fetch_arbeitnow_jobs(client: httpx.Client) -> list[dict]:
    response = client.get("https://www.arbeitnow.com/api/job-board-api", timeout=20)
    if response.status_code != 200:
        return []

    jobs: list[dict] = []
    for item in response.json().get("data", []):
        title = item.get("title", "")
        company = item.get("company", "") or "Hiring Organization"
        description = item.get("description", "")

        if not matches_haymarket_listing(title, company, description):
            continue

        location = ", ".join(filter(None, [item.get("location"), item.get("remote") and "Remote"]))
        jobs.append(
            normalize_job(
                external_id=f"arbeitnow-{item.get('slug', title)}",
                source="arbeitnow",
                title=title,
                company=company,
                location=location or "Remote",
                description=description,
                source_url=item.get("url"),
            )
        )

    return jobs


def fetch_remoteok_jobs(client: httpx.Client) -> list[dict]:
    response = client.get("https://remoteok.com/api", timeout=20)
    if response.status_code != 200:
        return []

    payload = response.json()
    if not isinstance(payload, list):
        return []

    jobs: list[dict] = []
    for item in payload:
        if not isinstance(item, dict) or not item.get("id"):
            continue

        title = item.get("position", "")
        company = item.get("company", "")
        description = item.get("description", "")
        tags = " ".join(item.get("tags", []))

        if not matches_haymarket_listing(title, company, f"{description} {tags}"):
            continue

        jobs.append(
            normalize_job(
                external_id=f"remoteok-{item['id']}",
                source="remoteok",
                title=title,
                company=company,
                location=item.get("location") or "Remote",
                description=description,
                salary=item.get("salary"),
                source_url=item.get("url") or item.get("apply_url"),
                published_at=item.get("date"),
            )
        )

    return jobs


def dedupe_jobs(jobs: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []

    for job in jobs:
        key = f"{job['title'].lower()}|{job['company'].lower()}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)

    return unique


def fetch_all_jobs() -> dict:
    sources: dict[str, int] = {}
    collected: list[dict] = []

    fetchers = [
        ("usfwc", fetch_usfwc_jobs),
        ("idealist", fetch_idealist_jobs),
        ("usajobs", fetch_usajobs),
        ("jobicy", fetch_jobicy_jobs),
        ("arbeitnow", fetch_arbeitnow_jobs),
        ("remoteok", fetch_remoteok_jobs),
    ]

    with httpx.Client(
        headers={"User-Agent": "Haymarket/1.0 (+https://haymarket.jobs)"},
        follow_redirects=True,
    ) as client:
        for name, fetcher in fetchers:
            try:
                results = fetcher(client)
                sources[name] = len(results)
                collected.extend(results)
            except Exception:
                sources[name] = 0

    jobs = dedupe_jobs(collected)
    return {"jobs": jobs, "sources": sources, "total": len(jobs)}
