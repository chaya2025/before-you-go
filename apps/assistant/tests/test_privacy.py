"""
The privacy filter. Two sides, both tested on purpose:
  1. numbers that identify a person never survive (passport, ID, licence, phone, email)
  2. the small numbers a real question needs DO survive ("form 89", "5 years", dates)
A filter that only passes side 1 would wreck every answer, so side 2 matters as much.
"""
import pytest

from app.privacy import REMOVED, strip_ids

# ---- side 1: these must disappear -------------------------------------------

MUST_GO = [
    ("my passport is P12345678 what now", "P12345678"),
    ("passport AB1234567", "AB1234567"),
    ("דרכון מספר 23456789A", "23456789A"),
    ("my ID is 123456782", "123456782"),
    ("ת.ז. 123 456 782", "123 456 782"),
    ("licence number 7654321", "7654321"),
    ("רישיון 12345678", "12345678"),
    ("call me 054-1234567", "054-1234567"),
    ("phone 054 123 4567", "054 123 4567"),
    ("+972-54-1234567 is my number", "+972-54-1234567"),
    ("+972 54 123 4567", "54 123 4567"),
    ("mail me at dana.k+byg@gmail.com please", "dana.k+byg@gmail.com"),
    # checker finding 4 (2026-11-23)
    ("passport AB 123456 expired", "123456"),
    ("licence C01X00T47 from Germany", "C01X00T47"),
    ("my passport 12AB34567", "12AB34567"),
    ("N° 1234 5678 on my licence", "1234 5678"),
    ("call +972 (54) 123-4567", "123-4567"),
    ("phone 054.123.4567", "054.123.4567"),
    ("phone 054  1234 567", "1234 567"),
    ("ID 123.456.789", "123.456.789"),
    ("ת.ז. 12-345-678", "12-345-678"),
    ("ID 12 345 678", "12 345 678"),
    ("licence 1234-5678", "1234-5678"),
]


@pytest.mark.parametrize("text, secret", MUST_GO)
def test_identifying_numbers_are_removed(text, secret):
    out = strip_ids(text)
    assert secret not in out
    assert REMOVED in out


def test_no_nine_digit_run_survives_anywhere():
    # Whatever the wording around it, no 7+ digit run may be left over.
    import re
    text = "id:123456782,passport=X9876543 and 0541234567."
    out = strip_ids(text)
    assert not re.search(r"\d{7,}", out)


# ---- side 2: these must stay exactly as written -----------------------------

MUST_STAY = [
    "Where do I get form 89?",
    "איפה מקבלים טופס 89?",
    "I have lived here 5 years",
    "regulation 216 says what?",
    "can I drive A5 or B?",
    "my visa ends on 12/05/2026",
    "my visa ends on 2026-05-12",
    "ויזה עד 12.05.2026",
    "from 2020-2026 I drove abroad",
    "is it 1,200 shekels?",
    "a 6 month wait, 30 days, 3 lessons",
    "category B, תקנה 190",
    "call *4515",
    # checker finding 4 (2026-11-23)
    "form 89 and 5 years",
    "regulation 216",
    "A5 or א/5?",
    "my visa ends on 15.2.2024",
    "visa until 2024-02-15",
    "the office number is 02-6663050",
    "or call *4515 from a mobile",
    "it costs 165 ₪",
    "דרגה B לפי תקנה 176 עד 181",
]


@pytest.mark.parametrize("text", MUST_STAY)
def test_question_numbers_are_kept(text):
    assert strip_ids(text) == text


def test_empty_and_none_safe():
    assert strip_ids("") == ""
