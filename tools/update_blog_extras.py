#!/usr/bin/env python3
"""Оновлює «похідні» від блогу файли після кожної нової статті:

1. feed.xml — RSS-стрічка 20 найсвіжіших статей (Google приймає її як додатковий sitemap
   для свіжого контенту; подається один раз у Search Console).
2. Блок «Свіжі статті» на головній (між маркерами CT-LATEST у index.html) — 3 останні
   статті. Головну Google обходить найчастіше, тож нова стаття знаходиться за години.

Джерело — картки в blog.html (найновіша — перша). Лише стандартна бібліотека Python 3.
Запуск із кореня репозиторію:  python3 tools/update_blog_extras.py
Ідемпотентний: якщо нічого не змінилось — файли не перезаписуються.
"""
import html
import json
import os
import re
import sys
from datetime import datetime, timezone
from email.utils import format_datetime

SITE = 'https://chisto-tak.com.ua/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEED_ITEMS = 20
LATEST_ITEMS = 3
START, END = '<!-- CT-LATEST:START -->', '<!-- CT-LATEST:END -->'


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8', newline='') as f:
        return f.read()


def write_if_changed(p, text):
    full = os.path.join(ROOT, p)
    old = None
    if os.path.exists(full):
        with open(full, encoding='utf-8', newline='') as f:
            old = f.read()
    if old == text:
        return False
    with open(full, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    return True


def strip(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip()


def cards():
    """Картки статей з blog.html у порядку сторінки (найновіша — перша)."""
    b = read('blog.html')
    out = []
    for m in re.finditer(r'<a href="blog/([^"]+\.html)" class="blog-card[^"]*"[^>]*>(.*?)</a>', b, re.S):
        slug, body = m.group(1), m.group(2)
        if not os.path.exists(os.path.join(ROOT, 'blog', slug)):
            continue
        title = re.search(r'<h2[^>]*>(.*?)</h2>', body, re.S)
        excerpt = re.search(r'<p class="mt-2[^"]*">(.*?)</p>', body, re.S)
        tag = re.search(r'<span class="tag [^"]*">(.*?)</span>', body, re.S)
        date = re.search(r'<span class="text-xs text-zinc-400">([^<]*\d{4})</span>', body)
        out.append({
            'slug': slug,
            'title': strip(title.group(1)) if title else slug,
            'excerpt': strip(excerpt.group(1)) if excerpt else '',
            'tag': strip(tag.group(1)) if tag else '',
            'date_text': date.group(1).strip() if date else '',
        })
    return out


def published(slug):
    """datePublished із JSON-LD статті (ISO), або None."""
    try:
        s = read('blog/' + slug)
    except FileNotFoundError:
        return None
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            d = json.loads(m.group(1))
        except Exception:
            continue
        for o in (d if isinstance(d, list) else [d]):
            if isinstance(o, dict) and o.get('@type') in ('Article', 'BlogPosting') and o.get('datePublished'):
                return o['datePublished']
    return None


def build_feed(items):
    # lastBuildDate = дата найсвіжішої статті (а не «зараз») — щоб повторний запуск нічого не змінював
    entries = []
    newest = None
    for it in items[:FEED_ITEMS]:
        iso = published(it['slug'])
        try:
            dt = datetime.fromisoformat(iso[:10]).replace(hour=9, tzinfo=timezone.utc) if iso else None
        except ValueError:
            dt = None
        if dt and (newest is None or dt > newest):
            newest = dt
        url = SITE + 'blog/' + it['slug']
        entries.append(
            '    <item>\n'
            f'      <title>{html.escape(it["title"])}</title>\n'
            f'      <link>{url}</link>\n'
            f'      <guid isPermaLink="true">{url}</guid>\n'
            + (f'      <pubDate>{format_datetime(dt)}</pubDate>\n' if dt else '')
            + (f'      <category>{html.escape(it["tag"])}</category>\n' if it['tag'] else '')
            + f'      <description>{html.escape(it["excerpt"])}</description>\n'
            '    </item>')
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        '  <channel>\n'
        '    <title>Блог ЧистоТак — поради з прибирання</title>\n'
        f'    <link>{SITE}blog.html</link>\n'
        f'    <atom:link href="{SITE}feed.xml" rel="self" type="application/rss+xml" />\n'
        '    <description>Поради з прибирання й догляду за домом від клінінгової компанії ЧистоТак (Київ, Львів).</description>\n'
        '    <language>uk</language>\n'
        + (f'    <lastBuildDate>{format_datetime(newest)}</lastBuildDate>\n' if newest else '')
        + '\n'.join(entries) + '\n'
        '  </channel>\n'
        '</rss>\n')


def build_latest(items):
    cards_html = []
    for it in items[:LATEST_ITEMS]:
        cards_html.append(
            f'        <a href="blog/{it["slug"]}" class="ct-latest-card">\n'
            + (f'          <span class="ct-latest-tag">{html.escape(it["tag"])}</span>\n' if it['tag'] else '')
            + f'          <span class="ct-latest-title">{html.escape(it["title"])}</span>\n'
            + (f'          <span class="ct-latest-excerpt">{html.escape(it["excerpt"])}</span>\n' if it['excerpt'] else '')
            + (f'          <span class="ct-latest-date">{html.escape(it["date_text"])}</span>\n' if it['date_text'] else '')
            + '        </a>')
    return (START + '\n'
            '  <section id="latest-posts" class="py-24">\n'
            '    <div class="max-w-7xl mx-auto px-4 sm:px-6">\n'
            '      <div class="text-center max-w-2xl mx-auto">\n'
            '        <h2 class="font-display text-4xl sm:text-5xl font-black tracking-tight leading-[1.15]">Свіжі <span class="gold-gradient-text italic">статті</span></h2>\n'
            '        <p class="mt-4 text-zinc-400">Поради з прибирання від нашої команди — нові матеріали щотижня.</p>\n'
            '      </div>\n'
            '      <div class="ct-latest-grid">\n'
            + '\n'.join(cards_html) + '\n'
            '      </div>\n'
            '      <div class="mt-8 text-center"><a href="blog.html" class="ct-more-btn">Усі статті блогу</a></div>\n'
            '    </div>\n'
            '  </section>\n'
            + END)


def main():
    items = cards()
    if not items:
        print('blog.html: карток не знайдено — нічого не змінюю'); return 1
    changed = []
    if write_if_changed('feed.xml', build_feed(items)):
        changed.append('feed.xml')
    idx = read('index.html')
    if START in idx and END in idx:
        a, b = idx.index(START), idx.index(END) + len(END)
        block = build_latest(items)
        if '\r\n' in idx:
            block = block.replace('\r\n', '\n').replace('\n', '\r\n')
        new = idx[:a] + block + idx[b:]
        if write_if_changed('index.html', new):
            changed.append('index.html')
    else:
        print('index.html: маркерів CT-LATEST немає — блок не оновлено')
    print('оновлено:', ', '.join(changed) if changed else 'нічого (усе актуально)')
    print('найсвіжіша стаття:', items[0]['slug'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
