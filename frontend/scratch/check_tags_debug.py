import re

def check_tags_debug(filepath, start, end):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    content = "".join(lines[start-1:end])
    pattern = re.compile(r'<(div|/div|PageShell|/PageShell|header|/header|aside|/aside)(\s+[^>]*?)?>', re.DOTALL)
    
    stack = []
    for match in pattern.finditer(content):
        full_tag = match.group(0)
        tag_name = match.group(1)
        line_num = start + content.count('\n', 0, match.start())
        
        if full_tag.strip().endswith('/>'): continue
            
        if not tag_name.startswith('/'):
            stack.append((tag_name, line_num))
            # print(f"DEBUG: [{line_num}] Opened {tag_name}. Stack: {[s[0] for s in stack]}")
        else:
            expected_name = tag_name[1:]
            if not stack:
                print(f"[{line_num}] EXTRA closing tag: {full_tag.strip()}")
            else:
                last_name, last_line = stack.pop()
                if last_name != expected_name:
                    print(f"[{line_num}] MISMATCH: expected closing for {last_name} (from {last_line}), but found {full_tag.strip()}")
                    # Push back the wrong one to keep tracing
                    # stack.append((last_name, last_line))

    while stack:
        tag_name, line_num = stack.pop()
        print(f"UNCLOSED: <{tag_name}> from line {line_num}")

if __name__ == "__main__":
    check_tags_debug('src/pages/MarketDetail.tsx', 599, 906)
