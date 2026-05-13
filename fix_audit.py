import os, glob, re

BASE = r"C:\Users\Admin\chistotak-site"

FIXES = [
    # 1. Clean-Clean logo → ЧистоТак in header/footer (all pages except index already fixed)
    ('Clean-<span class="text-gold-400">Clean</span>',
     'Чисто<span class="text-gold-400">Так</span>'),
    ('Clean-<span class="text-gold-500">Clean</span>',
     'Чисто<span class="text-gold-400">Так</span>'),
    ('>CC<', '>ЧТ<'),

    # 2. Green focus colors → gold
    ('focus:border-green-400', 'focus:border-yellow-500'),
    ('focus:ring-green-400/20', 'focus:ring-yellow-500/20'),
    ('focus:ring-yellow-500/20', 'focus:ring-yellow-500/20'),  # keep
    ('border-green-400/50', 'border-yellow-600/50'),
    ('accent-green-600', 'accent-color:#FFD700'),

    # 3. Cities in meta/schema → Солоне
    ('"Київ", "Дніпро", "Львів", "Харків", "Одеса"',
     '"Солоне", "Дніпропетровська область"'),
    ('"Київ", "Дніпро", "Львів", "Харків"',
     '"Солоне", "Дніпропетровська область"'),
    ('Прибирання квартир та офісів, хімчистка диванів, миття вікон. Київ, Дніпро, Львів, Харків, Одеса.',
     'Прибирання квартир та офісів, хімчистка диванів, миття вікон. Солоне та Дніпропетровська область.'),
    ('Київ, Дніпро, Львів, Харків.',
     'Солоне та область.'),
    ('Київ, Дніпро, Львів, Харків, Одеса.',
     'Солоне та Дніпропетровська область.'),

    # 4. Twitter/OG description cities
    ('Прибирання квартир, хімчистка, миття вікон. Київ, Дніпро, Львів, Харків.',
     'Прибирання квартир, хімчистка, миття вікон. Солоне та область.'),
]

total = 0
for path in glob.glob(BASE + "/**/*.html", recursive=True):
    with open(path, encoding='utf-8') as f:
        html = f.read()
    new = html
    for old, nw in FIXES:
        new = new.replace(old, nw)
    if new != html:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        total += 1
        print(f"FIXED: {os.path.relpath(path, BASE)}")

print(f"\nDone — {total} files fixed.")
