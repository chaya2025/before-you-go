"""
Fake test documents for M3 (upload and read).

Every name, number and date here is made up. Each image carries a SPECIMEN
stamp so nobody can mistake it for a real document. No real person, no
official specimen (M3 D-3).

Run:  python -I tools/make-fake-documents.py
Out:  apps/api/fixtures/documents/*.png|.pdf  + expected.json (what a correct read returns)
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, JpegImagePlugin  # noqa: F401 (PDF save needs it)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "apps", "api", "fixtures", "documents")
FONTS = "C:/Windows/Fonts"


def font(size, bold=False):
    return ImageFont.truetype(os.path.join(FONTS, "arialbd.ttf" if bold else "arial.ttf"), size)


def he(text):
    # PIL without libraqm draws left to right, so Hebrew is stored reversed.
    return text[::-1]


def card(w, h, bg, title, rows, band=None, title_size=34):
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 70], fill=band or (40, 60, 90))
    d.text((24, 16), title, font=font(title_size, True), fill="white")
    d.rectangle([24, 100, 214, 340], fill=(200, 200, 205))  # photo box
    d.text((70, 205), "PHOTO", font=font(24), fill=(120, 120, 125))
    y = 100
    for label, value in rows:
        d.text((250, y), label, font=font(18), fill=(90, 90, 95))
        d.text((250, y + 22), value, font=font(26, True), fill=(20, 20, 25))
        y += 62
    stamp = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(stamp).text((w // 2 - 230, h - 90), "SPECIMEN - NOT A REAL DOCUMENT", font=font(30, True), fill=(200, 30, 30, 160))
    img.paste(stamp, (0, 0), stamp)
    return img


def passport(expires_printed, name="DOE, ALEX SAMPLE"):
    return card(900, 560, (236, 232, 220), "PASSPORT / PASSEPORT  -  REPUBLIC OF EXAMPLIA", [
        ("Type / Type", "P"),
        ("Surname, Given names", name),
        ("Passport No.", "X7351942"),
        ("Date of birth", "14 MAR 1990"),
        ("Date of issue", "02 JUN 2021"),
        ("Date of expiry / Date d'expiration", expires_printed),
    ], title_size=28)


def visa():
    img = card(900, 520, (225, 236, 230), he("מדינת ישראל - אשרה ורישיון ישיבה"), [
        (he("סוג אשרה") + " / Visa type", "B/1"),
        (he("שם") + " / Name", "DOE, ALEX SAMPLE"),
        (he("מספר דרכון") + " / Passport", "X7351942"),
        (he("בתוקף מ") + " / Valid from", "01/09/2025"),
        (he("בתוקף עד") + " / Valid until", "31/08/2027"),
    ], band=(30, 80, 140), title_size=30)
    return img


def form_89():
    return card(900, 520, (238, 234, 225), he("רשות האוכלוסין וההגירה - מסמך 89"), [
        (he("מספר מסמך") + " / Document No.", "897351942"),
        (he("שם") + " / Name", "DOE, ALEX SAMPLE"),
        (he("מספר דרכון") + " / Passport No.", "X7351942"),
        (he("תאריך הנפקה") + " / Issued", "05/03/2024"),
    ], band=(70, 70, 70), title_size=30)


def licence_en():
    return card(900, 520, (230, 232, 240), "DRIVER LICENSE  -  STATE OF SAMPLETON", [
        ("Class", "C"),
        ("Name", "DOE, ALEX SAMPLE"),
        ("DL No.", "S000-0000-0000"),
        ("Issued", "11/04/2016"),
        ("Expires", "04/23/2029"),
    ], band=(90, 40, 40))


def licence_ru():
    return card(900, 520, (235, 228, 235), "ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ", [
        ("1. Фамилия / 2. Имя", "ИВАНОВА / ОЛЬГА"),
        ("4a. Дата выдачи", "20.07.2018"),
        ("4b. Действительно до", "20.07.2028"),
        ("5. Номер", "00 00 000000"),
        ("9. Категории", "B"),
    ], band=(60, 60, 110))


def wrong_document():
    img = Image.new("RGB", (900, 520), (250, 250, 250))
    d = ImageDraw.Draw(img)
    d.text((40, 40), "EXAMPLIA POWER & WATER CO.", font=font(34, True), fill=(20, 20, 20))
    d.text((40, 110), "Monthly bill - account 000-000", font=font(26), fill=(20, 20, 20))
    d.text((40, 170), "Amount due: 412.50", font=font(26), fill=(20, 20, 20))
    d.text((40, 230), "Due date: 15/11/2026", font=font(26), fill=(20, 20, 20))
    d.text((40, 440), "SPECIMEN - NOT A REAL DOCUMENT", font=font(30, True), fill=(200, 30, 30))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    docs = {
        # name: (image, expected kind, expected fields or None for "can't read")
        "passport-valid.png": (passport("17 MAY 2031"), "passport", {"expires": "2031-05", "number": "X7351942", "name_latin": "DOE ALEX SAMPLE"}),
        "passport-expired.png": (passport("09 FEB 2025"), "passport", {"expires": "2025-02", "number": "X7351942", "name_latin": "DOE ALEX SAMPLE"}),
        "passport-blurry.png": (passport("17 MAY 2031").filter(ImageFilter.GaussianBlur(9)).resize((300, 187)), "passport", None),
        "form-89.png": (form_89(), "form_89", {"number": "897351942", "passport_number": "X7351942", "name_latin": "DOE ALEX SAMPLE"}),
        "visa-b1.png": (visa(), "visa", {"expires": "2027-08"}),
        "licence-en.png": (licence_en(), "licence", {"expires": "2029-04", "name_latin": "DOE ALEX SAMPLE", "language": "en"}),
        "licence-ru.png": (licence_ru(), "licence", {"expires": "2028-07", "language": "other"}),
        "wrong-utility-bill.png": (wrong_document(), "passport", "wrong_document"),
    }
    expected = {}
    for name, (img, kind, want) in docs.items():
        img.save(os.path.join(OUT, name))
        expected[name] = {"kind": kind, "want": want}
    # One PDF, to prove the PDF path.
    passport("17 MAY 2031").save(os.path.join(OUT, "passport-valid.pdf"))
    expected["passport-valid.pdf"] = {"kind": "passport", "want": {"expires": "2031-05", "number": "X7351942", "name_latin": "DOE ALEX SAMPLE"}}
    with open(os.path.join(OUT, "expected.json"), "w", encoding="utf-8") as f:
        json.dump(expected, f, indent=2, ensure_ascii=False)
    print(f"{len(expected)} fake documents in {OUT}")


if __name__ == "__main__":
    sys.exit(main())
