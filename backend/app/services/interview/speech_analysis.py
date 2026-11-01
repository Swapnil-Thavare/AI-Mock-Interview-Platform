"""Deterministic speech-communication metrics computed from a transcript.

Pure functions — no database, network, or AI dependencies — so every metric is
independently unit-testable. Metrics are descriptive observations, not scores;
they must never be interpreted as judgments of intelligence, confidence, or
competence.

Fillers use a tiered lexicon:
- Unambiguous fillers ("um", "uh", "you know", ...) are always counted.
- Ambiguous fillers ("like", "so", "well", ...) are counted with lightweight
  context heuristics to avoid flagging normal grammatical usage, and are
  reported separately in the breakdown.
"""
import re
from collections import Counter
from typing import Dict, List, Optional

_WORD_RE = re.compile(r"[a-zA-Z]+(?:'[a-zA-Z]+)?")
_BOUNDARY_CHARS = ".!?;:,"

UNAMBIGUOUS_FILLER_WORDS = frozenset({"um", "uh", "hmm", "er", "ah", "eh"})
UNAMBIGUOUS_FILLER_PHRASES = frozenset(
    {"you know", "i mean", "sort of", "kind of"}
)
AMBIGUOUS_FILLER_WORDS = frozenset(
    {"like", "basically", "actually", "so", "well", "right", "just", "literally"}
)

# Context exclusions for ambiguous fillers — normal grammatical usage should
# not be counted as a filler.
_LIKE_PREV_NONFILLER = frozenset(
    {
        "i", "you", "we", "they", "he", "she", "it", "would", "could",
        "should", "feel", "feels", "felt", "look", "looks", "looked",
        "seem", "seems", "seemed", "sound", "sounds", "sounded",
        "something", "anything", "nothing",
    }
)
_LIKE_NEXT_NONFILLER = frozenset(
    {
        "a", "an", "the", "my", "your", "his", "her", "our", "their",
        "this", "that", "these", "those", "to",
    }
)
_SO_NEXT_NONFILLER = frozenset(
    {"that", "much", "many", "few", "little", "far", "long", "as", "called"}
)
_RIGHT_NEXT_NONFILLER = frozenset(
    {
        "now", "away", "side", "hand", "angle", "place", "time", "answer",
        "thing", "way", "amount", "size", "direction", "choice", "decision",
        "solution", "tool", "tools", "approach", "answer", "format", "data",
    }
)

# Common English stopwords excluded from repeated-content-word analysis.
_STOPWORDS = frozenset(
    {
        "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
        "at", "by", "for", "with", "about", "against", "between", "into",
        "through", "during", "before", "after", "above", "below", "to",
        "from", "up", "down", "in", "out", "on", "off", "over", "under",
        "again", "further", "once", "here", "there", "all", "any", "both",
        "each", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "than", "too", "very", "s", "t",
        "can", "will", "just", "should", "now", "i", "me", "my", "we",
        "you", "your", "he", "him", "his", "she", "her", "it", "its",
        "they", "them", "their", "this", "that", "these", "those", "am",
        "is", "are", "was", "were", "be", "been", "being", "have", "has",
        "had", "having", "do", "does", "did", "doing", "would", "could",
        "shall", "may", "might", "must", "of", "also", "as", "so", "well",
        "like", "um", "uh", "hmm", "er", "ah", "eh", "yeah", "yes",
        "okay", "ok", "really", "actually", "basically", "literally",
        "mean", "know", "kind", "sort", "right", "get", "got", "go",
        "going", "one", "two", "something", "anything", "everything",
        "thing", "things", "make", "made", "want", "see", "say", "said",
        "because", "while", "how", "what", "which", "who", "where", "why",
    }
)


def tokenize(transcript: str) -> List[str]:
    """Lowercased word tokens (contractions kept whole)."""
    return _WORD_RE.findall(transcript.lower())


def _tokens_with_boundaries(transcript: str) -> List[Dict[str, object]]:
    """Tokens with a flag for clause/sentence-start position."""
    out: List[Dict[str, object]] = []
    prev_end: Optional[int] = None
    for match in _WORD_RE.finditer(transcript):
        at_boundary = prev_end is None or bool(
            set(transcript[prev_end : match.start()]) & set(_BOUNDARY_CHARS)
        )
        out.append(
            {"word": match.group().lower(), "boundary": at_boundary}
        )
        prev_end = match.end()
    return out


def words_per_minute(word_count: int, seconds: Optional[float]) -> Optional[float]:
    """Words per minute; None when duration is missing or non-positive."""
    if seconds is None or seconds <= 0 or word_count <= 0:
        return None
    return round(word_count / (seconds / 60.0), 1)


def detect_fillers(transcript: str) -> Dict[str, object]:
    """Count filler usage, separating unambiguous and ambiguous matches.

    Returns {"count": int, "unambiguous": int, "ambiguous": int,
             "breakdown": {term: {"count": n, "ambiguous": bool}}}.
    """
    tokens = _tokens_with_boundaries(transcript)
    words = [str(t["word"]) for t in tokens]
    breakdown: Dict[str, Dict[str, object]] = {}
    skip_indices = set()

    def add(term: str, ambiguous: bool) -> None:
        entry = breakdown.setdefault(term, {"count": 0, "ambiguous": ambiguous})
        entry["count"] = int(entry["count"]) + 1

    # Multi-word unambiguous phrases first.
    for i in range(len(words) - 1):
        phrase = f"{words[i]} {words[i + 1]}"
        if phrase in UNAMBIGUOUS_FILLER_PHRASES:
            add(phrase, False)
            skip_indices.add(i)
            skip_indices.add(i + 1)

    for i, word in enumerate(words):
        if i in skip_indices:
            continue
        if word in UNAMBIGUOUS_FILLER_WORDS:
            add(word, False)
            continue
        if word not in AMBIGUOUS_FILLER_WORDS:
            continue
        prev_word = words[i - 1] if i > 0 else ""
        next_word = words[i + 1] if i + 1 < len(words) else ""
        at_boundary = bool(tokens[i]["boundary"])
        if word == "like":
            if (
                prev_word in _LIKE_PREV_NONFILLER
                or next_word in _LIKE_NEXT_NONFILLER
            ):
                continue
        elif word == "so":
            # Only clause-initial "So,"/sentence-initial counts as a discourse
            # filler; connective "so that/much/..." is normal grammar.
            if not at_boundary or next_word in _SO_NEXT_NONFILLER:
                continue
        elif word == "well":
            if not at_boundary or next_word in {"known", "done", "as"}:
                continue
        elif word == "right":
            if not at_boundary or next_word in _RIGHT_NEXT_NONFILLER:
                continue
        # "just", "basically", "actually", "literally" are counted wherever
        # they occur — they are discourse hedges in nearly every context.
        add(word, True)

    unambiguous = sum(
        int(v["count"]) for v in breakdown.values() if not v["ambiguous"]
    )
    ambiguous = sum(
        int(v["count"]) for v in breakdown.values() if v["ambiguous"]
    )
    return {
        "count": unambiguous + ambiguous,
        "unambiguous": unambiguous,
        "ambiguous": ambiguous,
        "breakdown": breakdown,
    }


def vocabulary_metrics(
    transcript: str, max_repeated: int = 5
) -> Dict[str, object]:
    """Unique-word ratio and repeated content words (stopwords excluded).

    The unique-word ratio is a raw type-token ratio — descriptive only and
    sensitive to transcript length (longer answers naturally score lower).
    """
    words = tokenize(transcript)
    if not words:
        return {"unique_word_ratio": None, "top_repeated_words": []}
    unique_ratio = round(len(set(words)) / len(words), 3)
    content = Counter(
        w for w in words if w not in _STOPWORDS and len(w) > 2
    )
    repeated = [
        {"word": word, "count": count}
        for word, count in content.most_common(max_repeated)
        if count >= 3
    ]
    return {
        "unique_word_ratio": unique_ratio,
        "top_repeated_words": repeated,
    }


def compute_speech_metrics(
    transcript: str,
    recording_seconds: Optional[float] = None,
    speech_seconds: Optional[float] = None,
) -> Dict[str, object]:
    """All transcript-derived metrics for one answer.

    Columns match interview_answer_speech_analysis; values are None where the
    inputs cannot support a metric.
    """
    words = tokenize(transcript or "")
    word_count = len(words)
    fillers = detect_fillers(transcript or "")
    vocab = vocabulary_metrics(transcript or "")
    filler_per_100 = (
        round(fillers["count"] / word_count * 100.0, 1)
        if word_count > 0
        else None
    )
    return {
        "word_count": word_count,
        "recording_seconds": recording_seconds,
        "speech_seconds": speech_seconds,
        "wpm_recording": words_per_minute(word_count, recording_seconds),
        "wpm_speech": words_per_minute(word_count, speech_seconds),
        "filler_count": fillers["count"],
        "filler_per_100_words": filler_per_100,
        "filler_breakdown": fillers["breakdown"],
        "unique_word_ratio": vocab["unique_word_ratio"],
        "top_repeated_words": vocab["top_repeated_words"],
    }


def sanitize_pause_stats(
    recording_seconds: Optional[float],
    pause_count: Optional[float],
    pause_total_seconds: Optional[float],
    pause_longest_seconds: Optional[float],
    speech_seconds: Optional[float],
) -> Dict[str, Optional[float]]:
    """Validate and clamp client-reported pause statistics.

    Client values are estimates and untrusted: negatives or inconsistent sets
    are discarded entirely, and durations are clamped to the recording length
    when it is known.
    """
    empty: Dict[str, Optional[float]] = {
        "pause_count": None,
        "pause_total_seconds": None,
        "pause_longest_seconds": None,
        "speech_seconds": None,
    }
    provided = [
        pause_count,
        pause_total_seconds,
        pause_longest_seconds,
        speech_seconds,
    ]
    if all(v is None for v in provided):
        return empty
    try:
        count = int(pause_count) if pause_count is not None else None
        total = (
            float(pause_total_seconds)
            if pause_total_seconds is not None
            else None
        )
        longest = (
            float(pause_longest_seconds)
            if pause_longest_seconds is not None
            else None
        )
        speech = (
            float(speech_seconds) if speech_seconds is not None else None
        )
    except (TypeError, ValueError):
        return empty

    values = [v for v in (count, total, longest, speech) if v is not None]
    if any(v < 0 for v in values):
        return empty
    duration = (
        float(recording_seconds)
        if recording_seconds and recording_seconds > 0
        else None
    )

    # Structural consistency: a zero-count with positive totals is invalid.
    if count == 0 and (total or 0) > 0:
        return empty
    if count is not None and count > 0 and total is None:
        return empty
    if longest is not None and total is not None and longest > total:
        longest = total
    if duration is not None:
        if total is not None:
            total = min(total, duration)
        if longest is not None:
            longest = min(longest, duration)
        if speech is not None:
            speech = min(speech, duration)
        if speech is not None and total is not None:
            speech = min(speech, max(0.0, duration - total))

    return {
        "pause_count": count,
        "pause_total_seconds": round(total, 3) if total is not None else None,
        "pause_longest_seconds": (
            round(longest, 3) if longest is not None else None
        ),
        "speech_seconds": round(speech, 3) if speech is not None else None,
    }
