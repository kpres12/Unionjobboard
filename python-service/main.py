from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fetchers import fetch_all_jobs

app = FastAPI(title="Haymarket Search Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Job(BaseModel):
    id: int
    title: str
    company: str
    location: str
    type: str
    description: str
    category: str
    salary: Optional[str] = None
    contactEmail: str
    postedBy: int
    posterName: Optional[str] = None
    createdAt: str
    score: Optional[float] = None


class SearchRequest(BaseModel):
    jobs: list[Job]
    query: Optional[str] = None
    location: Optional[str] = None
    type: Optional[str] = None


def tokenize(text: str) -> set[str]:
    return {word for word in text.lower().split() if len(word) > 2}


def score_job(job: Job, query: Optional[str], location: Optional[str], job_type: Optional[str]) -> float:
    score = 0.0

    if query:
        query_tokens = tokenize(query)
        searchable = " ".join([job.title, job.company, job.description, job.category]).lower()
        searchable_tokens = tokenize(searchable)

        overlap = query_tokens & searchable_tokens
        score += len(overlap) * 3.0

        if query.lower() in job.title.lower():
            score += 5.0
        if query.lower() in job.company.lower():
            score += 2.0

    if location and location.lower() in job.location.lower():
        score += 4.0

    if job_type and job.type == job_type:
        score += 3.0

    # Slight boost for newer listings (lexicographic ISO dates work here)
    score += 0.001

    return score


@app.get("/health")
def health():
    return {"status": "ok", "service": "python-search"}


@app.post("/search")
def search(request: SearchRequest):
    filtered = []

    for job in request.jobs:
        if request.type and job.type != request.type:
            continue
        if request.location and request.location.lower() not in job.location.lower():
            continue

        job_score = score_job(job, request.query, request.location, request.type)

        if request.query:
            query_tokens = tokenize(request.query)
            searchable = " ".join([job.title, job.company, job.description, job.category]).lower()
            if not any(token in searchable for token in query_tokens):
                continue

        job_dict = job.model_dump()
        job_dict["score"] = round(job_score, 2)
        filtered.append(job_dict)

    filtered.sort(key=lambda item: item["score"], reverse=True)
    return {"jobs": filtered}


class ApplicationScoreRequest(BaseModel):
    jobDescription: str
    coverLetter: str


@app.post("/score-application")
def score_application(request: ApplicationScoreRequest):
    job_tokens = tokenize(request.jobDescription)
    letter_tokens = tokenize(request.coverLetter)

    if not job_tokens or not letter_tokens:
        return {"score": 0.0}

    overlap = job_tokens & letter_tokens
    score = min(100.0, (len(overlap) / max(len(job_tokens), 1)) * 100)

    job_lower = request.jobDescription.lower()
    for token in letter_tokens:
        if token in job_lower:
            score += 2.0

    return {"score": round(min(100.0, score), 1)}


@app.get("/fetch-jobs")
def fetch_jobs():
    return fetch_all_jobs()
