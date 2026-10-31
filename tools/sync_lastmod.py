"""Оновлює <lastmod> у sitemap.xml за реальною датою останньої зміни контенту сторінки (з git).

Коміти, що лише міняють версії ассетів (?v=...), не рахуються — інакше Google
перестає довіряти lastmod. Потрібна повна історія git (fetch-depth: 0).
Запуск: python3 tools/sync_lastmod.py  → друкує, що змінилось.
"""
import os
import re
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(ROOT, 'sitemap.xml')
BASE = 'https://chisto-tak.com.ua/'
VER = re.compile(r'\?v=[\w.-]+')


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True,
                          encoding='utf-8', check=True).stdout


def content_date(path):
    """Дата (YYYY-MM-DD) останнього коміту, що змінив щось, крім ?v=..."""
    if git('diff', '--name-only', 'HEAD', '--', path).strip():   # ще не закомічено (напр. «Свіжі статті»)
        return date.today().isoformat()
    for line in git('log', '--format=%H %cs', '--', path).splitlines():
        sha, day = line.split()
        diff = git('show', sha, '--format=', '-U0', '--', path).splitlines()
        plus = sorted(VER.sub('', l[1:]).strip() for l in diff if l.startswith('+') and not l.startswith('+++'))
        minus = sorted(VER.sub('', l[1:]).strip() for l in diff if l.startswith('-') and not l.startswith('---'))
        if plus != minus:
            return day
    return None


def file_for(loc):
    rel = loc[len(BASE):] or 'index.html'
    if rel.endswith('/'):
        rel += 'index.html'
    if not rel.endswith(('.html', '.xml')):
        rel += '.html'
    return rel


def main():
    sm = open(SITEMAP, encoding='utf-8').read()
    changed = []

    def fix(m):
        loc, old = m.group(2), m.group(4)
        path = file_for(loc)
        new = content_date(path) if os.path.exists(os.path.join(ROOT, path)) else None
        if new and new > old:
            changed.append(f'{path}: {old} → {new}')
            return m.group(1) + m.group(2) + m.group(3) + new + m.group(5)
        return m.group(0)

    sm2 = re.sub(r'(<loc>)([^<]+)(</loc>\s*<lastmod>)([^<]+)(</lastmod>)', fix, sm)
    if sm2 != sm:
        open(SITEMAP, 'w', encoding='utf-8', newline='').write(sm2)
    print(f'lastmod оновлено: {len(changed)}')
    for c in changed:
        print('  ' + c)


if __name__ == '__main__':
    sys.exit(main())
