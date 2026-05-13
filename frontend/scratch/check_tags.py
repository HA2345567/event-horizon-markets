import re
import sys

def check_tags(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # regex to find <div...>, </div>, <PageShell...>, </PageShell>
    # Note: excluding self-closing tags like <div ... />
    pattern = re.compile(r'<(div|/div|PageShell|/PageShell)(\s+[^>]*)?>')
    
    stack = []
    
    for match in pattern.finditer(content):
        full_tag = match.group(0)
        tag_name = match.group(1)
        line_num = content.count('\n', 0, match.start()) + 1
        
        # Check if it's self-closing (e.g. <div />)
        if full_tag.endswith('/>'):
            continue
            
        if not tag_name.startswith('/'):
            # Opening tag
            stack.append((tag_name, line_num))
        else:
            # Closing tag
            expected_name = tag_name[1:]
            if not stack:
                print(f"Unmatched closing tag: {full_tag} at line {line_num}")
            else:
                last_name, last_line = stack.pop()
                if last_name != expected_name:
                    print(f"Mismatched tag: expected closing for {last_name} (from line {last_line}), but found {full_tag} at line {line_num}")

    while stack:
        tag_name, line_num = stack.pop()
        print(f"Unclosed tag: <{tag_name}> from line {line_num}")

if __name__ == "__main__":
    check_tags('src/pages/MarketDetail.tsx')
