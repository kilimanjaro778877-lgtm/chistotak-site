import glob
import os

CLARITY_SNIPPET = '''<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "y15hlel1sw");
</script>
'''

changed = []
for path in glob.glob("**/*.html", recursive=True):
    if ".git" in path.split(os.sep):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "clarity.ms/tag" in content or "</head>" not in content:
        continue

    content = content.replace("</head>", CLARITY_SNIPPET + "</head>", 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    changed.append(path)

print(f"Changed: {len(changed)}")
