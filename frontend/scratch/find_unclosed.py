import re

def find_unclosed_divs(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    # Pattern to find <div... or </div>
    # Ignore self-closing <div ... />
    re_open = re.compile(r'<div(\s+[^>]*)?>')
    re_close = re.compile(r'</div\s*>')
    re_self = re.compile(r'<div\s+[^>]*/>')

    for i, line in enumerate(lines):
        line_num = i + 1
        # Find all openings and closings on this line
        # This is tricky because one line can have multiple
        
        # Remove self-closing first to avoid confusion
        clean_line = re_self.sub('', line)
        
        # We need to process them in order on the line
        # For simplicity, let's just count them for now
        # But wait, order matters: <div></div> is fine, </div><div> is not.
        
        # Better: find all tags and their positions
        tags = []
        for m in re_open.finditer(line):
            if not m.group(0).endswith('/>'):
                tags.append(('open', m.start()))
        for m in re_close.finditer(line):
            tags.append(('close', m.start()))
        
        tags.sort(key=lambda x: x[1])
        
        for t_type, pos in tags:
            if t_type == 'open':
                stack.append(line_num)
            else:
                if not stack:
                    print(f"Extra closing </div> at line {line_num}")
                else:
                    stack.pop()
    
    for ln in stack:
        print(f"Unclosed <div> from line {ln}")

if __name__ == "__main__":
    find_unclosed_divs('src/pages/MarketDetail.tsx')
