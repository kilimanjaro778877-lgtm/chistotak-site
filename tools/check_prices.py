"""Перевірка цін і фактів по всьому сайту: знаходить застарілі ціни й суперечності.

Запуск з кореня репо:  python3 tools/check_prices.py   (код виходу 1 — є що виправити)
Правила оновлювати разом зі зміною цін (див. також FACTS у рутині блогу).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Речення про Львів (партнер зі своїм прайсом) — там свої ціни
LVIV = re.compile(r'Льв|Lviv|партнер|прайс', re.I)
SKIP_FILES = {'lviv.html', 'skilky-koshtuie-generalne-lviv.html', 'planove-prybyrannia.html',
              'yak-obraty-kliniing-kompaniyu.html', 'check_prices.py'}
P = r'(?<![\d.,])'           # число не є частиною більшого
RUB = r'(?:\s|&nbsp;)?₴'

RULES = [
    # (назва, regex, чи пропускати речення про Львів, чи пропускати речення про килим)
    ('Генеральне в Києві — 100 ₴/м², не 90', re.compile(P + r'90' + RUB + r'/м²'), True, False),
    ('Підтримуюче в Києві — 70 ₴/м², не 50/60/65', re.compile(P + r'(?:50|60|65)' + RUB + r'/м²'), True, False),
    ('Миття вікон — 220 ₴/м², 180 лише для килима', re.compile(P + r'180' + RUB), True, True),
    ('Замовлень 150+, не 2 500', re.compile(r'2(?:\s|&nbsp;)?500\+|2(?:\s|&nbsp;)?500 (?:замовлен|заказ)'), False, False),
    ('Хімчистка дивана як доп. послуга — 3 000 ₴', re.compile(r'(?:Хімчистка|Химчистка) дивана \+(?:1200|2400)₴'), False, False),
    ('Міста лише Київ і Львів', re.compile(r'Солоне|Харків(?!ськ)|Харьков(?!ск)|Одеса|Одесса|Дніпро(?!в)|Днепр(?!ов)'), False, False),
]
WINDOW = re.compile(r'вік|вікон|окон|окн|скл|стекл', re.I)
CARPET = re.compile(r'килим|ковр|ковёр', re.I)


def sentence(text, start, end):
    a = max(text.rfind('.', 0, start), text.rfind('\n', 0, start), text.rfind('>', 0, max(start - 160, 0)))
    b = text.find('.', end)
    return text[a + 1:(b if b != -1 else end + 120)]


def main():
    problems = []
    files = [p for p in ROOT.rglob('*') if p.suffix in ('.html', '.txt', '.js')
             and '.git' not in p.parts and 'node_modules' not in p.parts and p.name not in SKIP_FILES]
    for f in sorted(files):
        try:
            text = f.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        if 'http-equiv="refresh"' in text:
            continue
        for name, rx, skip_lviv, window_only in RULES:
            for m in rx.finditer(text):
                s = sentence(text, m.start(), m.end())
                ls = text.rfind('\n', 0, m.start()) + 1
                le = text.find('\n', m.end())
                whole_line = text[ls:le if le != -1 else len(text)]
                if skip_lviv and (LVIV.search(s) or (f.suffix == '.txt' and LVIV.search(whole_line))):
                    continue
                if window_only and (not WINDOW.search(s) or CARPET.search(s)):
                    continue
                line = text.count('\n', 0, m.start()) + 1
                snippet = re.sub(r'<[^>]+>', ' ', s)
                snippet = re.sub(r'\s+', ' ', snippet).strip()[:150]
                problems.append(f'{f.relative_to(ROOT).as_posix()}:{line}: [{name}] {snippet}')
    for p in problems:
        print(p)
    print(f'{len(problems)} problem(s)' if problems else 'OK: prices consistent')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
