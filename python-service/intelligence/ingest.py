from .scoring import compute_intent_scores
from .signals import derive_external_signals


def ingest_intelligence(context: dict) -> dict:
    organizations = context.get("organizations") or []
    jobs = context.get("jobs") or []

    signals = derive_external_signals(organizations, jobs)
    intent_scores = compute_intent_scores(signals, organizations)

    return {"signals": signals, "intentScores": intent_scores}
