from collections import defaultdict


def compute_intent_scores(signals: list[dict], organizations: list[dict]) -> list[dict]:
    by_org: dict[str, list[dict]] = defaultdict(list)

    for signal in signals:
        name = signal.get("organizationName")
        if name:
            by_org[name].append(signal)

    scores: list[dict] = []

    for org in organizations:
        name = org.get("name")
        if not name:
            continue

        org_signals = by_org.get(name, [])
        if not org_signals:
            continue

        weighted = sum(s.get("score", 0) * s.get("confidence", 0.5) for s in org_signals)
        total_weight = sum(s.get("confidence", 0.5) for s in org_signals) or 1
        score = round(min(weighted / total_weight, 100), 1)

        lead_weeks = min(s.get("leadWeeks", 4) for s in org_signals)
        titles = " · ".join(s.get("title", "") for s in org_signals[:3])

        scores.append(
            {
                "organizationName": name,
                "organizationSlug": org.get("slug"),
                "score": score,
                "leadWeeks": lead_weeks,
                "summary": titles[:280],
                "signalCount": len(org_signals),
            }
        )

    scores.sort(key=lambda entry: entry["score"], reverse=True)
    return scores
