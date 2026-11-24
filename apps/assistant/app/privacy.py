"""
============================================================================
PRIVACY FILTER: strip_ids(text)
============================================================================

WHY THIS EXISTS. The question a person types leaves our server three times:
to Claude (rewrite + answer), to Voyage (to turn it into a vector), and it
could end up in a log. People paste their passport number, ID, licence
number or phone into a chat without thinking. These users are legally
vulnerable, so we cut those numbers out BEFORE anything else touches the
text. Every later step only ever sees the cleaned text.

THE HARD PART is not over-cleaning. "form 89", "5 years", "regulation 216",
"A5", "12/05/2026" are exactly the numbers a licence question needs. So the
rules below only remove things that are LONG or SHAPED like an identifier:

  1. emails                                      dana@gmail.com
  2. a letter-and-digit token with 6+ digits,    P12345678, 23456789A,
     or 7+ characters with 4+ digits             C01X00T47, 12AB34567
  3. 1-3 letters, a space or dash, 6+ digits     AB 123456
  4. any 7+ digits written together              123456782, 0541234567
  5. digit groups joined by spaces, dashes,      054-123-4567, 123.456.789,
     dots or brackets that add up to 8+ digits   12 345 678, 1234-5678,
                                                 +972 (54) 123-4567

What rule 5 leaves alone ON PURPOSE (each is a number a question needs):
  - dates: 15.2.2024, 2024-02-15, 12.05.2026 (a year 1900-2099 plus day and
    month of 1-2 digits) and year ranges 2020-2026 (two years)
  - the licensing office's own phone, 02-6663050, which the chat itself gives
    out. *4515 is only 4 digits, so it is never a candidate.
  - amounts like "165 ₪" and "1,200" (a comma is never a joiner).

What it does NOT catch: a number spelled out in words, or an identifier
shorter than 8 digits written in parts. That is an accepted gap: catching
those would strip real question numbers.
"""

import re

# What a removed number is replaced with. Hebrew because most users write
# Hebrew; the system prompt tells Claude what it means.
REMOVED = "[מספר הוסר]"

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")

# Rules 2 + 3. (?<![A-Za-z0-9]) / (?![A-Za-z0-9]) mean "not glued to another
# letter or digit", which works next to Hebrew too (Python's \b would treat
# Hebrew letters as word characters).
_TOKEN = re.compile(r"(?<![A-Za-z0-9])[A-Za-z0-9]{6,}(?![A-Za-z0-9])")
_LETTERS_SPACE_DIGITS = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]{1,3}[ \-]\d{6,}(?![A-Za-z0-9])")

# Rules 4 + 5: an optional "+", then digit groups (a group may sit in
# brackets) joined by up to two spaces, a dash or a dot.
_GROUP = r"\(?\d+\)?"
_JOIN = r"(?: {1,2}|\s?[\-.]\s?)"
_DIGIT_RUN = re.compile(rf"\+?(?<![\d])(?:{_GROUP})(?:{_JOIN}{_GROUP})*(?![\d])")

# The licensing office's numbers: the chat hands these out, never strip them.
_OFFICE_DIGITS = {"026663050"}


def _is_id_token(tok: str) -> bool:
    digits = sum(c.isdigit() for c in tok)
    letters = len(tok) - digits
    if letters == 0:
        return False  # pure digits: rules 4 + 5 decide
    return digits >= 6 or (len(tok) >= 7 and digits >= 4)


def _is_year(g: str) -> bool:
    return len(g) == 4 and 1900 <= int(g) <= 2099


def _is_date_or_years(groups: list[str]) -> bool:
    if len(groups) == 3:
        # 15.2.2024 / 2024-02-15: one year at an end, day and month of 1-2 digits.
        y_first = _is_year(groups[0]) and all(len(g) <= 2 for g in groups[1:])
        y_last = _is_year(groups[2]) and all(len(g) <= 2 for g in groups[:2])
        return y_first or y_last
    if len(groups) == 2:
        # 2020-2026, or a month and year like 2024-02.
        return (_is_year(groups[0]) and _is_year(groups[1])) or (
            _is_year(groups[0]) and len(groups[1]) <= 2
        ) or (_is_year(groups[1]) and len(groups[0]) <= 2)
    return False


def _is_identifier_run(run: str) -> bool:
    groups = re.findall(r"\d+", run)
    digits = "".join(groups)
    if digits in _OFFICE_DIGITS:
        return False
    # Rule 4: 7+ digits glued together is never a question number.
    if max(len(g) for g in groups) >= 7:
        return True
    if len(groups) < 2 or _is_date_or_years(groups):
        return False
    # Rule 5: split up, but 8+ digits in total = phone, ID or licence in parts.
    return len(digits) >= 8


def _replace_run(match: re.Match) -> str:
    return REMOVED if _is_identifier_run(match.group(0)) else match.group(0)


def strip_ids(text: str) -> str:
    """Return the text with identifying numbers replaced by REMOVED."""
    if not text:
        return text or ""
    out = _EMAIL.sub(REMOVED, text)
    out = _LETTERS_SPACE_DIGITS.sub(REMOVED, out)
    out = _TOKEN.sub(lambda m: REMOVED if _is_id_token(m.group(0)) else m.group(0), out)
    out = _DIGIT_RUN.sub(_replace_run, out)
    return out
