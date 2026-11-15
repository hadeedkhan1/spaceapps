import os
from functools import lru_cache
from urllib.parse import urlparse

import httpx

SERPAPI_URL = "https://serpapi.com/search.json"
ALLOWED_HOSTS = (
    "nasa.gov",
    "pubmed.ncbi.nlm.nih.gov",
    "nih.gov",
    "nature.com",
    "science.org",
    "frontiersin.org",
    "plos.org",
    "thelancet.com",
    "sciencedirect.com",
    "academic.oup.com",
    "springer.com",
)

SEARCH_TERMS = {
    "sleep_hours": "NASA astronaut sleep circadian spaceflight",
    "mood": "NASA astronaut behavioral health mood spaceflight",
    "hrv": "NASA astronaut heart rate variability microgravity",
    "heart_rate": "NASA astronaut cardiovascular heart rate microgravity",
    "temperature": "NASA astronaut thermoregulation body temperature spaceflight",
    "glucose": "NASA astronaut glucose metabolism spaceflight",
    "blood_pressure": "NASA astronaut blood pressure orthostatic microgravity",
    "exercise_minutes": "NASA astronaut exercise countermeasures bone muscle loss",
    "vision_symptoms": "NASA astronaut vision symptoms spaceflight SANS",
}

CURATED = {
    "heart_rate": [{
        "title": "NASA cardiovascular monitoring in microgravity",
        "url": "https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf",
        "snippet": "NASA technical publication providing cardiovascular and heart-rate research context in microgravity.",
    }],
    "hrv": [{
        "title": "NASA cardiovascular monitoring in microgravity",
        "url": "https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf",
        "snippet": "NASA technical publication providing cardiovascular and heart-rate variability research context in microgravity.",
    }],
    "vision_symptoms": [{
        "title": "NASA astronaut vision and SANS research",
        "url": "https://www.nasa.gov/missions/station/iss-research/science-in-space-july-28-2023-astronaut-vision/",
        "snippet": "NASA research context for astronaut ocular health and visual symptoms.",
    }],
}
DEFAULT_CURATED = [{
    "title": "NASA Twins Study",
    "url": "https://www.nasa.gov/humans-in-space/twins-study/about/",
    "snippet": "NASA longitudinal human-spaceflight research context; it does not validate this app's score.",
}]


def _allowed(url):
    host = (urlparse(url).hostname or "").lower()
    return any(host == domain or host.endswith("." + domain) for domain in ALLOWED_HOSTS)


@lru_cache(maxsize=32)
def _cached_search(query):
    key = os.environ.get("SERPAPI_API_KEY") or os.environ.get("SERPAPI_KEY")
    if not key:
        return ()
    params = {
        "engine": "google",
        "q": f"{query} (site:nasa.gov OR site:pubmed.ncbi.nlm.nih.gov OR site:nih.gov OR site:nature.com OR site:frontiersin.org)",
        "api_key": key,
        "num": 5,
    }
    response = httpx.get(SERPAPI_URL, params=params, timeout=12.0)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("SerpApi returned an unexpected response")
    results = []
    for row in payload.get("organic_results") or []:
        url = str(row.get("link") or "")
        if not url.startswith("https://") or not _allowed(url):
            continue
        title = str(row.get("title") or "").strip()
        snippet = str(row.get("snippet") or "").strip()
        if title and snippet:
            results.append({"title": title[:240], "url": url, "snippet": snippet[:500]})
        if len(results) == 3:
            break
    return tuple(results)


def search_evidence(result):
    if result.get("status") != "scored":
        return {"provider": "none", "results": [], "query": None}
    flagged = [item for item in result.get("worst") or [] if item.get("color") in ("yellow", "red")]
    if not flagged:
        return {"provider": "none", "results": [], "query": None}

    category = flagged[0].get("category", "")
    query = SEARCH_TERMS.get(category, "NASA human spaceflight health research")
    if os.environ.get("SERPAPI_API_KEY") or os.environ.get("SERPAPI_KEY"):
        try:
            hits = list(_cached_search(query))
            if hits:
                return {"provider": "serpapi", "results": hits, "query": query}
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            pass
    curated = CURATED.get(category, DEFAULT_CURATED)
    provider = "curated" if not (os.environ.get("SERPAPI_API_KEY") or os.environ.get("SERPAPI_KEY")) else "curated_fallback"
    return {"provider": provider, "results": curated, "query": query}
